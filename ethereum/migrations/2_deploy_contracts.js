const strings = artifacts.require('strings.sol');
const SafeMath = artifacts.require('SafeMath.sol');
const YKStructs = artifacts.require('YKStructs.sol');
const YKTranches = artifacts.require('YKTranches.sol');
const YKAccounts = artifacts.require('YKAccounts.sol');
const YKCommunities = artifacts.require('YKCommunities.sol');
const YKRewards = artifacts.require('YKRewards.sol');
const YKarma = artifacts.require('YKarma.sol');

const fs = require('fs');
const envFile = '../server/.env';

module.exports = (deployer, network, accounts) => {
  const owner = accounts[0];
  var adminEmail = '';
  deployer.then(async () => {

    var data = await checkEnvFile();
    adminEmail = getAdminEmail(data);
    // if we already have a YKarma, don't deploy
    if (process.env.TRUFFLE_ENV === 'production') {
      if (process.env.YKARMA_ADDRESS) return;
      if (data.indexOf("YKARMA_ADDRESS=") >= 0) return;
    }

    await deployer.deploy(strings, {from : owner});
    await deployer.deploy(SafeMath, {from : owner});
    await deployer.deploy(YKStructs, {from : owner});
    await deployer.deploy(YKTranches, {from : owner});
    await deployer.deploy(YKAccounts, {from : owner});
    await deployer.link(strings, YKTranches, YKAccounts);
    await deployer.link(SafeMath, YKTranches);
    await deployer.deploy(YKCommunities, {from : owner});
    await deployer.deploy(YKRewards, {from : owner});
    await deployer.deploy(YKarma, YKTranches.address, YKAccounts.address, YKCommunities.address, YKRewards.address, {from : owner});
    setEnvAddress(YKarma.address);
    const ykt = await YKTranches.deployed();
    await ykt.addOracle(YKarma.address, {from: owner});
    const yka = await YKAccounts.deployed();
    await yka.addOracle(YKarma.address, {from : owner});
    const ykc = await YKCommunities.deployed();
    await ykc.addOracle(YKarma.address, {from : owner});
    const ykv = await YKRewards.deployed();
    await ykv.addOracle(YKarma.address, {from : owner});
    const yk = await YKarma.deployed();
    await yk.addNewCommunity(0, 0x0, 'ykarma.com', '{"name":"Alpha Karma"}', 'alpha,test');
    await yk.addNewAccount(1, 0, '{"name":"Jon"}', 'mailto:' + adminEmail);
    await yk.replenish(1);
    
    // add test data if appropriate
    if (process.env.TRUFFLE_ENV !== 'production') {
      await yk.addNewAccount(1, 0, '{"name":"Test"}', 'mailto:test@example.com');
      await yk.addNewAccount(1, 0, '{"name":"Test Two"}', 'mailto:test2@example.com');
      await yk.addNewReward(2, 10, 2, "alpha", '{"name":"A Test Reward"}', '0x00');
      await yk.replenish(2);
      await yk.give(2, 'mailto:'+adminEmail, 80, "Just a message");
      await yk.give(1, 'mailto:test@example.com', 20, "Another message");
    }
  });
};

function checkEnvFile() {
  return new Promise(function(resolve, reject){
    fs.readFile(envFile, "utf-8", (err, data) => {
        err ? resolve('') : resolve(data);
    });
  });
}

function getAdminEmail(data) {
  var idx = data.indexOf('ADMIN_EMAIL');
  if (idx > 0) {
    var start = s.indexOf('=', idx+1);
    var end = s.indexOf('\n', start+1);
    var addr = s.substring(start+1, end);
    return addr;
  }
  return "n/a";
}

function setEnvAddress(address) {
  // update .env if appropriate
  if (process.env.TRUFFLE_ENV === 'production') {
    const s = `YKARMA_ADDRESS=${address}\n`;
    fs.writeFile(envFile, s, 'utf8', (err) => {
      if (err) throw err;
      console.log("Address written");
    });
  } else {
    fs.readFile(envFile, "utf8", (err, data) => {
      var s = ""+data;
      if (err) throw err;
      var idx = data.indexOf('YKARMA_ADDRESS');
      if (idx > 0) {
        var start = s.indexOf('=', idx+1);
        var end = s.indexOf('\n', start+1);
        var addr = s.substring(start+1, end);
        s = s.replace(addr, ""+address);
        fs.writeFile(envFile, s, 'utf8', (err) => {
          if (err) throw err;
          console.log("Address written");
        });
      }
    });
  }
}