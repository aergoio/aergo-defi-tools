var $ = require('jquery');
var swal = require('sweetalert2');
var herajs = require('@herajs/client');
var chainId = '';
var aergo = null;
var showbox = false;

function install_extension_click() {
  var win = window.open('https://chrome.google.com/webstore/detail/aergo-connect/iopigoikekfcpcapjlkcdlokheickhpc', '_blank');
  win.focus();
  hide_box();
}

function hide_box() {
  showbox = false;
  $('#no-extension').remove();
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

async function startTxSendRequest(txdata) {
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
    var url
    if (chainId == "aergo.io") {
      url = "mainnet-api-http.aergo.io"
    } else if (chainId == "testnet.aergo.io") {
      url = "testnet-api-http.aergo.io"
    } else if (chainId == "alpha.aergo.io") {
      url = "alpha-api-http.aergo.io"
    }
    url = 'http://' + url + ':7845'
    aergo = new herajs.AergoClient({}, new herajs.GrpcWebProvider({url: url}))
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
    title: 'Congratulations!',
    html: '<br>Your token was created!<br>&nbsp;',
    confirmButtonText: 'View on Aergoscan',
    cancelButtonText: 'Close',
    showCancelButton: true,
    width: 600,
    padding: '3em',
    confirmButtonColor: '#e5007d',
    background: '#fff',
    backdrop: `
      rgba(0,0,123,0.4)
      url("/images/nyan-cat.gif")
      left top
      no-repeat
    `,
    preConfirm: function() {
      var win = window.open(url, '_blank');
      win.focus();
    }
  })

}

function encode_utf8(s) {
  return unescape(encodeURIComponent(s));
}

async function create_token(){

  const factory_address_testnet = "AmgXrg6JC7NT4URYhop1G4QaQme9WtdV7CX6dvawJekEk52bBBZw"
  const factory_address_mainnet = ""
  var factory_address

  var name = document.getElementById("tokenName").value
  var symbol = document.getElementById("tokenSymbol").value
  var decimals = document.getElementById("decimals").value
  var initial_supply = document.getElementById("initialSupply").value
  var max_supply = document.getElementById("maxSupply").value
  var owner = null  //document.getElementById("owner").value

  decimals = parseInt(decimals)
  if (decimals > 18) {
    swal.fire({
      icon: 'error',
      text: 'The maximum number of decimals is 18'
    })
    return false
  }

  var options = {}

  var list = [...document.querySelectorAll(`#extensions > div > input`)]
  list.forEach(function(item) {
    if (item.checked) {
      options[item.id] = true
    }
  })

  if (max_supply) {
    if (document.getElementById("mintable").checked) {
      options["max_supply"] = max_supply
    } else {
      swal.fire({
        icon: 'error',
        text: 'The Max Supply can only be used with the mintable extension'
      })
      return false
    }
  }

  var account_address = await getActiveAccount();

  if (chainId == "testnet.aergo.io") {
    factory_address = factory_address_testnet
  } else if (chainId == "aergo.io") {
    factory_address = factory_address_mainnet
  //} else if (chainId == "alpha.aergo.io") {
  //  factory_address = factory_address_alphanet
  } else {
    swal.fire({
      icon: 'error',
      text: 'This network is not yet supported'
    })
    return false
  }

  var txdata = {
    type: 5,  // CALL
    from: account_address,
    to:   factory_address,
    amount: 0,
    payload_json: {
      Name: "new_token",
      Args: [name, symbol, decimals, initial_supply, options, owner]
    }
  }

  startTxSendRequest(txdata);
}

function create_token_click(){
  create_token()
  return false
}

document.getElementById("create-token").onclick = create_token_click;
