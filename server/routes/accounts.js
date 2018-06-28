var express = require('express');
var router = express.Router();
var bodyParser = require("body-parser");
var eth = require('./eth');
var util = require('./util');
var firebase = require('./firebase');

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// TODO: if it's a community admin, use their address if available
var communityAdminAddress = null;
eth.web3.eth.getAccounts().then((ethAccounts) => {
  communityAdminAddress = ethAccounts[0];
});

const ADMIN_ID = 1;

/* GET account list */
router.get('/for/:communityId', function(req, res, next) {
  const communityId = parseInt(req.params.communityId);
  if (parseInt(req.session.ykid) !== ADMIN_ID && parseInt(req.session.communityAdminId) !== communityId) {
    return res.json([]);
  }
  var accounts = [];
  var method = eth.contract.methods.getAccountCount(communityId);
  method.call(function(error, result) {
    if (error) {
      console.log('getAccountCount error', error);
      res.json([]);
    } else {
      console.log('getAccountCount result', result);
      for (var i = 0; i < result; i++) {
        getAccountWithinCommunity(communityId, i, (account) => {
          accounts.push(account);
          console.log('callback', accounts);
          if (accounts.length >= result) {
            res.json(accounts);
          }
        });
      }
    }
  })
  .catch(function(error) {
    console.log('getAccountCount call error', error);
  });
});

/* GET account details */
router.get('/:id', function(req, res, next) {
  const id = parseInt(req.params.id);
  if (parseInt(req.session.ykid) !== ADMIN_ID && parseInt(req.session.ykid) !== id) {
    return res.json({"success":false, "error": "Not authorized"});
  }
  getAccountFor(id, (account) => {
    console.log('callback', account);
    res.json(account);
  });
});


/* GET account details */
router.get('/url/:url', function(req, res, next) {
  /*
  if (req.session.ykid !== ADMIN_ID && req.session.email !== req.params.url) {
    return res.json({"success":false, "error": "Not authorized"});
  }
  */
  var url = "mailto:" + req.params.url;
  if (!util.verifyURLs(url)) {
    return res.json({"success":false, "error": 'Bad URL(s)'});
  }
  getAccountForUrl(url, (account) => {
    console.log('callback', account);
    res.json(account);
  });
});


/* PUT edit account */
router.put('/update', function(req, res, next) {
  var account = req.body.account;
  console.log("account", JSON.stringify(account));
  if (account.id === 0) {
    return res.json({"success":false, "error": 'Account ID not set'});
  }
  if (req.session.ykid !== ADMIN_ID && req.session.ykid !== account.id) {
    return res.json({"success":false, "error": "Not authorized"});
  }
  var method = eth.contract.methods.editAccount(
    account.id,
    account.userAddress,
    JSON.stringify(account.metadata),
  );
  method.send({from:communityAdminAddress, gas: eth.GAS}, (error, result) => {
    if (error) {
      console.log('error', error);
      res.json({"success":false, "error": error});
    } else {
      console.log('result', result);
      res.json(account);
    }
  })
  .catch(function(error) {
    console.log('call error ' + error);
    res.json({"success":false, "error": error});
  });
});


/* DELETE remove account. */
router.delete('/:id', function(req, res, next) {
  if (req.session.ykid !== ADMIN_ID) {
    return res.json({"success":false, "error": "Admin only"});
  }
  if (req.params.id === 0) {
    return res.json({"success":false, "error": 'Account not saved'});
  }
  var method = eth.contract.methods.deleteAccount(req.params.id);
  method.send({from:communityAdminAddress, gas: eth.GAS}, (error, result) => {
    if (error) {
      console.log('error', error);
      res.json({"success":false, "error": error});
    } else {
      console.log('result', result);
      res.json({"success":true});
    }
  })
  .catch(function(error) {
    console.log('call error ' + error);
  });
});


/* PUT give coins */
router.post('/give', function(req, res, next) {
  var sender = req.session.ykid === ADMIN_ID ? req.body.id : req.session.ykid;
  var recipient = req.body.email;
  if (!recipient.startsWith("mailto:")) {
    recipient = "mailto:" + recipient;
  }
  if (!util.verifyURLs(recipient)) {
    return res.json({"success":false, "error": "Bad URL"});
  }
  console.log(`About to give ${req.body.amount} from id ${sender} to ${recipient}`, req.body.message);
  var method = eth.contract.methods.give(
    sender,
    recipient,
    req.body.amount,
    req.body.message || '',
  );
  method.send({from:communityAdminAddress, gas: eth.GAS}, (error, result) => {
    if (error) {
      console.log('error', error);
      res.json({"success":false, "error": error});
    } else {
      console.log('result', result);
      var docRef = firebase.db.collection('email-preferences').doc(recipient);
      docRef.get().then((doc) => {
        // TODO: query rather than get entire document?
        var sendEmail = !doc.exists || doc.recipient.data().all || !doc.recipient.data()[sender]; 
        if (sendEmail) {
          const senderName = req.session.name || req.session.email;
          sendKarmaSentMail(senderName, recipient, req.body.amount);
          docRef.update({ [sender]:true }, { create: true } );
        }
        res.json({"success":true});
      })
      .catch(err => {
        console.log('Error getting document', err);
        res.json({"success":false, "error":err});
      });
    }
  })
  .catch(function(error) {
    console.log('call error ' + error);
  });
});


/* POST set token */
router.post('/token/set', function(req, res, next) {
  firebase.admin.auth().verifyIdToken(req.body.token).then(function(decodedToken) {
    req.session.uid = decodedToken.uid;
    req.session.name = decodedToken.displayName;
    req.session.email = decodedToken.email;
    req.session.ykid = req.body.ykid;
    // console.log("session", req.session);
    res.json({"success":true});
  }).catch(function(error) {
    res.json({"success":false, "error":error});
  });
});


function getAccountFor(id, callback) {
  var method = eth.contract.methods.accountForId(id);
  console.log("accountForId", id);
  method.call(function(error, result) {
    if (error) {
      console.log('getAccountFor error', error);
    } else {
      console.log('getAccountFor result', result);
      var account = getAccountFromResult(result);
      callback(account);
    }
  })
  .catch(function(error) {
    console.log('getAccountFor call error ' + id, error);
  });
}

function getAccountWithinCommunity(communityId, idx, callback) {
  var method = eth.contract.methods.accountWithinCommunity(communityId, idx);
  console.log("accountWithinCommunity id", communityId);
  console.log("accountWithinCommunity idx", idx);
  method.call(function(error, result) {
    if (error) {
      console.log('accountWithinCommunity error', error);
    } else {
      console.log('accountWithinCommunity result', result);
      var account = getAccountFromResult(result);
      callback(account);
    }
  })
  .catch(function(error) {
    console.log('accountWithinCommunity call error ' + id, error);
  });
}

function getAccountForUrl(url, callback) {
  var method = eth.contract.methods.accountForUrl(url);
  method.call(function(error, result) {
    if (error) {
      console.log('getAccountForUrl error', error);
    } else {
      // console.log('getAccountForUrl result', result);
      var account = getAccountFromResult(result);
      callback(account);
    }
  })
  .catch(function(error) {
    console.log('getAccountFor call error ' + id, error);
  });
}

function getAccountFromResult(result) {
  return {
    id:           result[0],
    communityId:  result[1],
    userAddress:  result[2],
    metadata:     JSON.parse(result[3] || '{}'),
    urls:         result[4],
    rewards:      result[5],
    givable:      result[6],
    given:        JSON.parse(result[7] || '{}'),
    spendable:    JSON.parse(result[8] || '{}'),
  };
}

function sendKarmaSentMail(sender, recipient, amount) {
  var recipientEmail = recipient.replace("mailto:","");
  // TODO check that the URL is an email address
  const msg = {
    to: recipientEmail,
    from: 'karma@ykarma.com',
    subject: `${sender} just sent you ${amount} YKarma!`,
    text: 'You should totally find out more!',
    html: '<strong>You should totally find out more.</strong>',
  };
  sgMail.send(msg);  
}

module.exports = router;
