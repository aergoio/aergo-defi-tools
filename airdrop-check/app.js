var $ = require('jquery');
var swal = require('sweetalert2');
var herajs = require('@herajs/client');
var aergo;
var chainId = '';
var account_address;
var showbox = false;

const airdrop_factory_mainnet = ""
const airdrop_factory_testnet = "Amgyrri9XzGCcDN9jD1KABnhNwD9xc6uBjsLRvvETTHKub5ZyEUG"
const airdrop_factory_alphanet = "AmhnEsiu8SGPn6DJ6QDMMAC1xFaovxXG5Vpjw3G78s1Wca84Rvvs"
var airdrop_factory_address

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

  update_list()
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
    typed = typed.substring(0, pos) + typed.substring(pos + 1)
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

  update_list()

  document.getElementById('card1').style.display = 'none'
  document.getElementById('card2').style.display = 'block'

  return false
}

async function update_list(){

  $('.table tbody tr').remove()
  //$('#none-available').hide()
  //$('#loader').show()
  document.getElementById('loader').style.display = 'inline-block'
  document.getElementById('none-available').style.display = 'none'

  var airdrops
  var count = 0

  while(true){

    try {
      airdrops = await aergo.queryContract(airdrop_factory_address, "has_tokens", account_address, count + 1, 100)
    } catch (e) {
      console.log(e)
      swal.fire({
        icon: 'error',
        text: 'Not able to query the token locker contract'
      })
      break
    }

    if (!(airdrops instanceof Array)) break

    for(var index=0; index<airdrops.length; index++){
      var airdrop = airdrops[index]

      var amount = airdrop.amount
      if (airdrop.decimals > 0) {
        amount = to_decimal_str(amount, airdrop.decimals)
      }

      var row = "<tr><td>" + airdrop.name + "</td><td>" + amount + " " + airdrop.symbol + "</td><td>"
      row = row + "<a href=\"javascript:window.claim_clicked('" + airdrop.address + "')\">claim</a>"
      row = row + "</td></tr>"

      $('.table tbody').append(row)
    }

    count += airdrops.length
  }

  //$('#loader').hide()
  document.getElementById('loader').style.display = 'none'
  if (count==0) {
    //$('#none-available').show()
    document.getElementById('none-available').style.display = 'block'
  }
}

window.claim_clicked = async function(airdrop_address){

  var txdata = {
    type: 5,  // CALL
    from: account_address,
    to: airdrop_address,
    amount: 0,
    payload_json: {
      Name: "withdraw",
      Args: []
    }
  }

  startTxSendRequest(txdata, 'Your tokens were claimed!')

}

document.getElementById("connect-wallet").onclick = connect_wallet_click;
