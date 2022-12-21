var $ = require('jquery');
var swal = require('sweetalert2');
var herajs = require('@herajs/client');
var aergo;
var chainId = '';
var account_address;
var token_info = {};
var token_address;
var decimals;
var amount;
var total_amount;
var cur_step = 0;
var timer_id;
var showbox = false;

const airdrop_factory_mainnet = ""
const airdrop_factory_testnet = "Amgyrri9XzGCcDN9jD1KABnhNwD9xc6uBjsLRvvETTHKub5ZyEUG"
const airdrop_factory_alphanet = "AmhnEsiu8SGPn6DJ6QDMMAC1xFaovxXG5Vpjw3G78s1Wca84Rvvs"
var airdrop_factory_address
var airdrop_address

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

function connect_to_aergo() {
  var url
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

  var site = chainId.replace('aergo','aergoscan')
  if (site == 'aergoscan.io') site = 'mainnet.aergoscan.io'

  if (receipt.status == "SUCCESS") {
    if (cur_step == 1) {
      airdrop_address = receipt.result
      airdrop_address = airdrop_address.replace(/^"|"$/g, '')
      var url = 'https://' + site + '/account/' + airdrop_address
      document.getElementById("airdrop-address").href = url
    }
  }else{
    swal.fire({
      icon: 'error',
      title: 'Failed!',
      text: receipt.result
    })
    return false
  }

  var url = 'https://' + site + '/transaction/' + result.hash

  swal.fire({
    icon: 'success',
    //title: 'OK',
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

  next_step()
}

function encode_utf8(s) {
  return unescape(encodeURIComponent(s));
}

function convert_typed_amount(typed, num_decimals){
  var amount
  if(!typed || typed=='') typed = '0'
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

async function connect_wallet_click(){

  account_address = await getActiveAccount();

  if (chainId == "testnet.aergo.io") {
    airdrop_factory_address = airdrop_factory_testnet
  } else if (chainId == "aergo.io") {
    airdrop_factory_address = airdrop_factory_mainnet
  } else if (chainId == "alpha.aergo.io") {
    airdrop_factory_address = airdrop_factory_alphanet
  } else {
    swal.fire({
      icon: 'error',
      text: 'This network is not yet supported'
    })
    return false
  }

  if (!aergo) {
    connect_to_aergo()
  }

  if (chainId == "aergo.io") {
    multicall = multicall_mainnet
  } else if (chainId == "testnet.aergo.io") {
    multicall = multicall_testnet
  } else {
    multicall = multicall_alphanet
  }

  if (cur_step == 0) {
    next_step()
  }

  return false
}

async function check_token_info(address, error_msg){

  if (!token_info[address]) {
    try {
      var result = await aergo.queryContract(multicall, "aggregate",
                     [address,"name"],
                     [address,"symbol"],
                     [address,"decimals"]
                   )
      token_info[address] = {
        name: result[0],
        symbol: result[1],
        decimals: result[2]
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

async function create_contract_click(){

  token_address = document.getElementById("tokenAddress").value
  var type = document.getElementById('airdrop-type').value
  amount = null

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

  if (type == 'same') {

    amount = document.getElementById("amount").value
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

  }

//next_step()
//return false

  var txdata = {
    type: 5,  // CALL
    from: account_address,
    to: airdrop_factory_address,
    amount: 0,
    payload_json: {
      Name: "new_airdrop",
      Args: [null, token_address, type, amount]
    }
  }

  startTxSendRequest(txdata, 'The AirDrop contract was created!');
}

function update_total_amount(){

  var recipients_str = document.getElementById("recipients").value
  var recipients

  // remove empty lines
  var trimmed = false
  var lines = recipients_str.split('\n')
  for(var i=0; i<lines.length; i++){
    var line = lines[i].trim()
    if(line!=lines[i]){
      lines[i] = line
      trimmed = true
    }
  }
  var nbefore = lines.length
  lines = lines.filter(item => item != '')
  if (trimmed || lines.length != nbefore) {
    document.getElementById("recipients").value = lines.join('\n')
  }

  var type = document.getElementById('airdrop-type').value

  if (type == 'same') {
    // convert it into an array
    recipients = lines
    // use the number of recipients to calculate the amount
    total_amount = BigInt(amount) * BigInt(recipients.length)
  }else{
    // convert it into an array
    recipients = {}
    total_amount = BigInt(0)
    for(var i=0; i<lines.length; i++){
      var item = lines[i].split(',')
      item[1] = convert_typed_amount(item[1], decimals)
      recipients[item[0]] = item[1]
      // sum the individual amounts
      total_amount += BigInt(item[1]) 
    }
  }

  total_amount = total_amount.toString()

  // display the total amount
  var symbol = token_info[token_address].symbol
  var amount_str = to_decimal_str(total_amount, decimals) + " " + symbol
  document.getElementById('total-amount1').innerHTML = amount_str
  document.getElementById('total-amount2').innerHTML = amount_str

  document.getElementById('num-recipients').innerHTML = recipients.length

  return recipients
}

function add_recipients_click(){

  //next_step()
  //return false

  var recipients = update_total_amount()

  var txdata = {
    type: 5,  // CALL
    from: account_address,
    to: airdrop_address,
    amount: 0,
    payload_json: {
      Name: "add_recipients",
      Args: [recipients]
    }
  }

  startTxSendRequest(txdata, 'The recipients were recorded on the contract!');

  return false
}

function transfer_tokens_click(){

  //next_step()
  //return false

  var txdata = {
    type: 5,  // CALL
    from: account_address,
    to: token_address,
    amount: 0,
    payload_json: {
      Name: "transfer",
      Args: [airdrop_address, total_amount]
    }
  }

  startTxSendRequest(txdata, 'The tokens were transferred!');

  return false
}

async function next_step(){

  if (cur_step==4) return;

  cur_step++;

  document.getElementById('card' + cur_step).style.display = 'none'
  document.getElementById('card' + (cur_step+1)).style.display = 'block'

}

document.getElementById("connect-wallet").onclick = connect_wallet_click;
document.getElementById("create-contract").onclick = create_contract_click;
document.getElementById("add-recipients").onclick = add_recipients_click;
document.getElementById("transfer-tokens").onclick = transfer_tokens_click;

document.getElementById('tokenAddress').addEventListener('input', async function(){
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
  }
})

document.getElementById('airdrop-type').addEventListener('change', function(){
  if (this.value == 'diff') {
    document.getElementById("amount").value = ''
    document.getElementById('amount-div').style.display = 'none'
  } else {
    document.getElementById('amount-div').style.display = 'block'
  }
})

document.getElementById('recipients').addEventListener('input', async function(){

  if (timer_id) {
    clearTimeout(timer_id)
  }

  if (this.value.length == 0){
    timer_id = null
    return
  }

  timer_id = setTimeout(function(){
    update_total_amount()
  }, 1000)

})
