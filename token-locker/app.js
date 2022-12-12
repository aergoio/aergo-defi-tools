var $ = require('jquery');
var swal = require('sweetalert2');
var herajs = require('@herajs/client');
var aergo;
var chainId = 'testnet.aergo.io';
var account_address;
var token_info = {};
var decimals;
var showbox = false;

const token_locker_address_mainnet = "Amg5nZV4qsjSYaageL13gZ2ohc4vdz6JQuVaYHaNnG3o1sBT5bVL"
const token_locker_address_testnet = "AmhXTtDUv7ZCJHB8Bz29S5F8pEj5F6gmb6wGLzUn7ADwergXNJAc"
const token_locker_address_alphanet = "AmhAvnBPJFhocdon7icguc5Yerd9amHqnVTeJ8bK2tr227pnh2X3"
var token_locker_address

const multicall_mainnet = "AmhAzXNo7o9jK7Wsq6v3DcJcY7vvsD8EYPhuWNHq5RFFYxwJR5kX"
const multicall_testnet = "AmgdCQrHpEo9CTndsMQoH8mQ1famXVFmwin8vyGba7PrRshkT9sL"
const multicall_alphanet = "AmgjhaVAtHB9WUWakYfXjqziwPeFts2HqtXbKo7ESe5MLLfALLX6"
var multicall


function install_extension_click() {
  var win = window.open('https://chrome.google.com/webstore/detail/aergo-connect/iopigoikekfcpcapjlkcdlokheickhpc', '_blank');
  win.focus();
  hide_box();
}

function hide_box() {
  showbox = false;
  $('#no-extension').remove();
}

function update_contract_addresses() {

  if (chainId == "testnet.aergo.io") {
    token_locker_address = token_locker_address_testnet
  } else if (chainId == "aergo.io") {
    token_locker_address = token_locker_address_mainnet
  } else if (chainId == "alpha.aergo.io") {
    token_locker_address = token_locker_address_alphanet
  } else {
    swal.fire({
      icon: 'error',
      text: 'This network is not yet supported'
    })
    return false
  }

  if (chainId == "aergo.io") {
    multicall = multicall_mainnet
  } else if (chainId == "testnet.aergo.io") {
    multicall = multicall_testnet
  } else {
    multicall = multicall_alphanet
  }

}

function connect_to_aergo() {
  var url
  update_contract_addresses()
  if (chainId == "aergo.io") {
    url = "mainnet-api-http.aergo.io"
  } else if (chainId == "testnet.aergo.io") {
    url = "testnet-api-http.aergo.io"
  } else if (chainId == "alpha.aergo.io") {
    url = "alpha-api-http.aergo.io"
  }
  url = 'https://' + url
  aergo = new herajs.AergoClient({}, new herajs.GrpcWebProvider({url: url}))
}

function aergoConnectCall(action, responseType, data) {

  showbox = true;
  setTimeout(function() {
    if (!showbox) return;

    const box = '<div id="no-extension" class="no-extension swal2-container swal2-center">' +
    '<div class="swal2-content swal2-html-container" style="display: block;"><br>Nothing happened?</div>' +
    '<button id="install-extension" type="button" class="swal2-confirm swal2-styled" aria-label="" ' +
    'style="display: inline-block; background-color: rgb(229, 0, 125); border-left-color: rgb(229, 0, 125);' +
    'border-right-color: rgb(229, 0, 125);">Install Aergo Connect</button></div>';

    $('body').append(box);
    $("#install-extension").click(install_extension_click);

  }, 3000);

  return new Promise((resolve, reject) => {
    window.addEventListener(responseType, function(event) {
      hide_box();
      if ('error' in event.detail) {
        reject(event.detail.error);
      } else {
        resolve(event.detail);
      }
    }, { once: true });
    window.postMessage({
      type: 'AERGO_REQUEST',
      action: action,
      data: data,
    }, '*');
  });

}

async function getActiveAccount() {
  const result = await aergoConnectCall('ACTIVE_ACCOUNT', 'AERGO_ACTIVE_ACCOUNT', {});
  chainId = result.account.chainId;
  return result.account.address;
}

async function startTxSendRequest(txdata, msg) {
  const result = await aergoConnectCall('SEND_TX', 'AERGO_SEND_TX_RESULT', txdata);
  console.log('AERGO_SEND_TX_RESULT', result);

  swal.fire({
    title: 'Transaction sent!',
    text: 'Waiting inclusion on blockchain...',
    allowEscapeKey: false,
    allowOutsideClick: false,
    onOpen: () => {
      swal.showLoading();
    }
  })

  if (!aergo) {
    connect_to_aergo()
  }

  // wait until the transaction is executed and included in a block, then get the receipt
  const receipt = await aergo.waitForTransactionReceipt(result.hash);
  console.log("receipt", receipt);

  if (receipt.status != "SUCCESS") {
    swal.fire({
      icon: 'error',
      title: 'Failed!',
      text: receipt.result
    })
    return false
  }

  var site = chainId.replace('aergo','aergoscan');
  if (site == 'aergoscan.io') site = 'mainnet.aergoscan.io';
  var url = 'https://' + site + '/transaction/' + result.hash;

  swal.fire({
    icon: 'success',
    title: 'OK',
    html: '<br>' + msg + '<br>&nbsp;',
    confirmButtonText: 'View on Aergoscan',
    cancelButtonText: 'Close',
    showCancelButton: true,
    width: 600,
    padding: '3em',
    confirmButtonColor: '#e5007d',
    background: '#fff',
    preConfirm: function() {
      var win = window.open(url, '_blank');
      win.focus();
    }
  })

  on_tokens_locked()
}

function encode_utf8(s) {
  return unescape(encodeURIComponent(s));
}

function convert_typed_amount(typed, num_decimals){
  var amount
  typed = typed.replace(',','.')
  var pos = typed.indexOf('.')
  if (pos < 0) {
    amount = typed + "0".repeat(num_decimals)
  }else{
    var num_trailing = typed.length - pos - 1
    var to_add = num_decimals - num_trailing
    typed = typed.substring(0, pos) + typed.substring(pos+1)
    if (to_add > 0) {
      amount = typed + "0".repeat(to_add)
    }else if(to_add < 0) {
      amount = typed.substring(0, typed.length + to_add)
    }else{
      amount = typed
    }
  }
  if (amount.match(/[^0-9]/) != null){
    return null  // invalid input
  }
  amount = amount.replace(/^0+/,'')  // remove leading zeros
  return amount
}

function to_decimal_str(amount, num_decimals, ntrunc) {
  if (typeof amount === "bigint") {
    amount = amount.toString()
  }
  if (num_decimals == 0) {
    return amount
  }
  if(ntrunc && ntrunc>0 && amount.length>ntrunc){
    amount = amount.substr(0, ntrunc) + "0".repeat(amount.length - ntrunc)
  }
  var index = amount.length - num_decimals
  if (index > 0) {
    amount = amount.substring(0, index) + "." + amount.substring(index)
  } else {
    amount = "0." + "0".repeat(-index) + amount
  }
  amount = amount.replace(/0+$/, '') // remove trailing zeros
  if(ntrunc!=-1){
  amount = amount.replace(/\.$/, '') // remove trailing .
  }
  return amount
}

function addMonths(date, months) {
  //var date = new Date(date)  // do not modify the original
  var d = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + months);
  if (date.getUTCDate() != d) {
    date.setUTCDate(0);
  }
  return date;
}

async function lock_tokens(){

  var token_address = document.getElementById("tokenAddress").value
  var amount = document.getElementById("amount").value
  var recipient = document.getElementById("recipient").value
  var interval

  if (!token_address || token_address == '') {
    swal.fire({
      icon: 'error',
      text: 'You must inform the token address'
    })
    return false
  }

  try {
    herajs.Address.decode(token_address)
  } catch (e) {
    swal.fire({
      icon: 'error',
      text: 'The token address is invalid'
    })
    return false
  }

  if (recipient) {
    try {
      herajs.Address.decode(recipient)
    } catch (e) {
      swal.fire({
        icon: 'error',
        text: 'The recipient address is invalid'
      })
      return false
    }
  }

  if (!amount || amount == '') {
    swal.fire({
      icon: 'error',
      text: 'The amount cannot be empty'
    })
    return false
  }

  if (decimals > 0) {
    //amount = BigInt(amount) * BigInt("1" + "0".repeat(decimals))
    //amount = amount.toString()
    amount = convert_typed_amount(amount, decimals)
    if (amount == null) {
      swal.fire({
        icon: 'error',
        text: 'The amount is invalid'
      })
      return false
    }
  }

  var time_type = document.getElementById('time').value

  if (time_type == 'date') {
    var date_str = document.getElementById('date').value
    var date = new Date(date_str)

    if (!date || date <= new Date()) {
      swal.fire({
        icon: 'error',
        text: 'The date must be in the future'
      })
      return false
    }

    interval = "on " + parseInt(date.getTime() / 1000)

  } else {
    var period = document.getElementById('period').value
    period = parseInt(period)

    if (!period || period <= 0) {
      swal.fire({
        icon: 'error',
        text: 'The period is invalid'
      })
      return false
    }

    switch (time_type) {
    case 'years':
      period = period * 12;
    case 'months':
      var date = addMonths(new Date(), period);
      interval = "on " + parseInt(date.getTime() / 1000)
      break;
    //
    case 'weeks':
      period = period * 7;
    case 'days':
      period = period * 24;
    case 'hours':
      period = period * 60;
    case 'minutes':
      period = period * 60;
    case 'seconds':
      interval = period;
    }
  }

  if (recipient) {
    var args = [token_locker_address, amount, interval, recipient]
  } else {
    var args = [token_locker_address, amount, interval]
  }

  var txdata = {
    type: 5,  // CALL
    from: account_address,
    to: token_address,
    amount: 0,
    payload_json: {
      Name: "transfer",
      Args: args
    }
  }

  startTxSendRequest(txdata, 'Your tokens were locked!');
}

window.withdraw_clicked = async function(index){

  var txdata = {
    type: 5,  // CALL
    from: account_address,
    to: token_locker_address,
    amount: 0,
    payload_json: {
      Name: "withdraw",
      Args: [index]
    }
  }

  startTxSendRequest(txdata, 'Your tokens were withdrawn!');
}

async function connect_wallet_click(){

  account_address = await getActiveAccount();

  update_contract_addresses()

  if (!aergo) {
    connect_to_aergo()
  }

  document.getElementById('card1').style.display = 'none'
  document.getElementById('card-user-locks').style.display = 'block'

  update_account_locks()

  return false
}

async function check_token_info(address, error_msg){

  if (!token_info[address]) {
    try {
      var result = await aergo.queryContract(multicall, "aggregate",
                     [address,"name"],
                     [address,"symbol"],
                     [address,"decimals"],
                     [address,"totalSupply"]
                   )
      token_info[address] = {
        name: result[0],
        symbol: result[1],
        decimals: result[2],
        total_supply: BigInt(result[3]._bignum)
      }
    } catch (e) {
      console.log(e)
      if (error_msg) {
        swal.fire({
          icon: 'error',
          text: error_msg
        })
      }
    }
  }

}

async function update_account_locks(address) {
  var locks
  var is_using_wallet = !address

  if (!address) {
    address = account_address
    var table = '#user-locks-table'
    var loader = '#loading-user-locks'
  } else {
    var table = '#account-locks-table'
    var loader = '#loading-account-locks'
  }

  $(`${table} tbody tr`).remove()
  $(loader).show()

  if (!aergo) {
    connect_to_aergo()
  }

  try {
    locks = await aergo.queryContract(token_locker_address, "locks_per_account", address)
  } catch (e) {
    console.log(e)
    swal.fire({
      icon: 'error',
      text: 'Not able to query the token locker contract'
    })
    return
  }

  if (!locks || !Array.isArray(locks)) locks = [];

  for(var index=0; index<locks.length; index++){
    var lock = locks[index]

    //lock.token
    //lock.amount
    //lock.expiration_time

    // retrieve the name, symbol and decimals
    await check_token_info(lock.token, 'Not able to query the token contract')

    var name = token_info[lock.token].name
    var symbol = token_info[lock.token].symbol
    var decimals2 = token_info[lock.token].decimals

    var amount = to_decimal_str(lock.amount, decimals2, 5)

    var expiration = (new Date(lock.expiration_time*1000)).toLocaleString()

    var row = `<tr><td>${name}</td><td>${amount} ${symbol}</td><td>${expiration}</td></tr>`

    $(`${table} tbody`).append(row)

    if (is_using_wallet) {
      var links = "<div>"
      links += `<a class="btn btn-primary btn-sm" href="javascript:window.extend_clicked(${index+1})">Extend</a>`
      links += `<a class="btn btn-primary btn-sm" href="javascript:window.transfer_clicked(${index+1})">Transfer</a>`
      if (lock.expiration_time < parseInt((new Date()).getTime()/1000)) {
        links += `<a class="btn btn-primary btn-sm" href="javascript:window.withdraw_clicked(${index+1})">Withdraw</a>`
      }
      links += "</div>"
      row = `<tr><td colspan="3">${links}</td></tr>`
      $(`${table} tbody`).append(row)
    }

  }

  $(loader).hide()

}

async function update_token_locks(token_address) {
  var locks

  $('#token-locks-table tbody tr').remove()
  $('#loading-token-locks').show()

  if (!aergo) {
    connect_to_aergo()
  }

  // retrieve the name, symbol and decimals
  await check_token_info(token_address, 'Not able to query the token contract. Please check the token address.')

  var name = token_info[token_address].name
  var symbol = token_info[token_address].symbol
  var decimals2 = token_info[token_address].decimals

  document.getElementById('info-token-name').innerHTML = 'Token Name: ' + name
  document.getElementById('info-token-symbol').innerHTML = 'Token Symbol: ' + symbol

  try {
    locks = await aergo.queryContract(token_locker_address, "locks_per_token", token_address)
  } catch (e) {
    console.log(e)
    swal.fire({
      icon: 'error',
      text: 'Not able to query the token locker contract'
    })
    return
  }

  if (!locks || !Array.isArray(locks)) locks = [];

  var total_supply  = token_info[token_address].total_supply
  var locked_supply = BigInt(0)

  for (var lock of locks) {
    //lock.account
    //lock.amount
    //lock.expiration_time

    var amount = lock.amount
    locked_supply += BigInt(lock.amount)
    amount = to_decimal_str(lock.amount, decimals2, 5)

    var expiration = (new Date(lock.expiration_time*1000)).toLocaleString()

    var short_account = lock.account.substring(0, 5) + '...' + lock.account.substring(lock.account.length - 4)

    var row = `<tr><td title="${lock.account}">${short_account}</td>
               <td>${amount} ${symbol}</td><td>${expiration}</td></tr>`

    $('#token-locks-table tbody').append(row)
  }

  // update the chart

  var locked_percent = (locked_supply * BigInt(100)) / total_supply
  locked_percent = parseInt(locked_percent.toString())  // from BigInt to Number

  document.getElementById('chart').setAttribute('stroke-dasharray', `${locked_percent} ${100 - locked_percent}`)
  document.getElementById('locked-percent').innerHTML = `${locked_percent}%`  // `${locked_percent.toFixed(2)}%`

  // update the token supply info

  var circul_supply = total_supply - locked_supply

  total_supply  = to_decimal_str(total_supply,  decimals2)
  locked_supply = to_decimal_str(locked_supply, decimals2)
  circul_supply = to_decimal_str(circul_supply, decimals2)

  document.getElementById('info-total-supply').innerHTML  = `Total Supply: ${total_supply} ${symbol}`
  document.getElementById('info-locked-supply').innerHTML = `Locked Supply: ${locked_supply} ${symbol}`
  document.getElementById('info-circul-supply').innerHTML = `Circulating Supply: ${circul_supply} ${symbol}`

  $('#loading-token-locks').hide()
  $('.svg-chart').show()

}

function add_lock_click(){
  document.getElementById('card-user-locks').style.display = 'none'
  document.getElementById('card-add-lock').style.display = 'block'
  return false
}

function lock_tokens_click(){
  lock_tokens()
  return false
}

async function on_tokens_locked(){
  document.getElementById('card-add-lock').style.display = 'none'
  document.getElementById('card-user-locks').style.display = 'block'
  update_account_locks()
}

function cancel_add_click(){
  document.getElementById('card-add-lock').style.display = 'none'
  document.getElementById('card-user-locks').style.display = 'block'
}

function view_account_locks_click() {

  var address = document.getElementById('account-address').value

  if (address) {
    try {
      herajs.Address.decode(address)
    } catch (e) {
      swal.fire({
        icon: 'error',
        text: 'The account address is invalid'
      })
      return false
    }
  } else {
    swal.fire({
      icon: 'error',
      text: 'Please enter the account address'
    })
    return false
  }

  document.getElementById('card1').style.display = 'none'
  document.getElementById('card-account-locks').style.display = 'block'

  update_account_locks(address)

  return false
}

async function view_token_locks_click() {

  var token_address = document.getElementById('token-address').value

  if (token_address) {
    try {
      herajs.Address.decode(token_address)
    } catch (e) {
      swal.fire({
        icon: 'error',
        text: 'The token address is invalid'
      })
      return false
    }
  } else {
    swal.fire({
      icon: 'error',
      text: 'Please enter the token address'
    })
    return false
  }

  document.getElementById('card1').style.display = 'none'
  document.getElementById('card-token-locks').style.display = 'block'

  update_token_locks(token_address)

  return false
}

document.getElementById("back-button-1").onclick = function(){
  document.getElementById('card1').style.display = 'block'
  document.getElementById('card-token-locks').style.display = 'none'
  return false
}

document.getElementById("back-button-2").onclick = function(){
  document.getElementById('card1').style.display = 'block'
  document.getElementById('card-account-locks').style.display = 'none'
  return false
}

document.getElementById("back-button-3").onclick = function(){
  document.getElementById('card1').style.display = 'block'
  document.getElementById('card-user-locks').style.display = 'none'
  return false
}

document.getElementById("view-account-locks").onclick = view_account_locks_click;
document.getElementById("view-token-locks").onclick = view_token_locks_click
document.getElementById("connect-wallet").onclick = connect_wallet_click;
document.getElementById("add-lock").onclick = add_lock_click;
document.getElementById("lock-tokens").onclick = lock_tokens_click;
document.getElementById("cancel-add").onclick = cancel_add_click;

document.getElementById('tokenAddress').addEventListener('input', async function () {
  if (this.value.length == 52) {
    var token_address = this.value

    if (!aergo) {
      connect_to_aergo()
    }

    await check_token_info(token_address, 'Not able to query the token contract. Is the address correct?')

    var name = token_info[token_address].name
    var symbol = token_info[token_address].symbol
    decimals = token_info[token_address].decimals

    if ((name && name != '') || (symbol && symbol != '')) {
      document.getElementById('tokenName').innerHTML = 'Name: ' + name
      document.getElementById('tokenSymbol').innerHTML = 'Symbol: ' + symbol
      document.getElementById('token_info').style.display = 'block'
    }

  //} else {
  //  document.getElementById('tokenName').value = 'Name:'
  //  document.getElementById('tokenSymbol').value = 'Symbol:'
  }
})

document.getElementById('time').addEventListener('change', function () {
  if (this.value == 'date') {
    document.getElementById('date-div').style.display = 'block'
    document.getElementById('period-div').style.display = 'none'
  } else {
    document.getElementById('date-div').style.display = 'none'
    document.getElementById('period-div').style.display = 'block'
  }
})
