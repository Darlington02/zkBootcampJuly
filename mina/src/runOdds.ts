import * as readline from 'readline';
import {
  Field,
  isReady,
  Mina,
  Party,
  PrivateKey,
  UInt64,
  shutdown,
  Permissions,
} from 'snarkyjs';
import { Odds } from './theOdds.js';

let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(theQuestion: string): Promise<string> {
  return new Promise((resolve) =>
    rl.question(theQuestion, (answ) => resolve(answ))
  );
}

const doProofs = false;

export async function run() {
  await isReady;
  // initialize local blockchain
  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);

  // the mock blockchain gives you access to 10 accounts
  const deployerAcc = Local.testAccounts[0].privateKey;
  const player1Acc = Local.testAccounts[1].privateKey;
  const player2Acc = Local.testAccounts[2].privateKey;

  const zkAppPrivkey = PrivateKey.random();
  const zkAppAddress = zkAppPrivkey.toPublicKey();

  const zkAppInstance = new Odds(zkAppAddress);
  if (doProofs) {
    try {
      await Odds.compile(zkAppAddress);
    } catch (err) {
      console.log(err);
    }
  }
  let honeypot = Field(50000);
  let minOdd = Field(2);
  let maxOdd = Field(100);

  // deploy smart contract and initialize values
  try {
    const tx = await Mina.transaction(deployerAcc, () => {
      // Party.fundNewAccount(deployerAcc);
      zkAppInstance.deploy({
        zkappKey: zkAppPrivkey,
      });
      zkAppInstance.setPermissions({
        ...Permissions.default(),
        editState: Permissions.proofOrSignature(),
        receive: Permissions.proofOrSignature(),
        send: Permissions.proofOrSignature(),
      });
      zkAppInstance.init(
        player1Acc.toPublicKey(),
        player2Acc.toPublicKey(),
        honeypot,
        minOdd,
        maxOdd
      );
    });
    await tx.send().wait();
  } catch (err) {
    console.log(err);
  }

  console.log(
    'zkApp balance after deployment: ',
    Mina.getBalance(zkAppAddress).toString()
  );

  console.log(
    'player2 balance before game begins: ',
    Mina.getBalance(player1Acc.toPublicKey()).toString()
  );

  console.log('Reward price to be distributed: ', honeypot);

  console.log('Player1 starts the round');
  let selectedOdd = await askQuestion(
    'what is your Odds (Ensure its between 2-100)? \n'
  );
  try {
    const tx2 = await Mina.transaction(player1Acc, () => {
      let userParty = Party.createSigned(player1Acc);

      zkAppInstance.player1SelectOdd(Field(selectedOdd));
      userParty.balance.subInPlace(new UInt64(honeypot));
      if (!doProofs) {
        zkAppInstance.sign(zkAppPrivkey);
      }
    });
    if (doProofs) await tx2.prove();
    await tx2.send().wait();
  } catch (err) {
    console.log(err);
  }
  console.log(
    'owner balance after starting round: ',
    Mina.getBalance(player1Acc.toPublicKey()).toString()
  );

  await sleep(1000);
  console.log('Switching to user 2 in 3 sec...');
  await sleep(1000);
  console.log('2 sec ...');
  await sleep(1000);
  console.log('1 sec ...');
  await sleep(1000);

  console.log(
    'hash of player1 commitment is: ',
    zkAppInstance.player1commitment.get().toString()
  );
  let odd = await askQuestion('Hey user2, what is your odd? \n');
  try {
    const tx3 = await Mina.transaction(player2Acc, () => {
      zkAppInstance.player2SelectOdd(Field(odd));
      if (!doProofs) {
        zkAppInstance.sign(zkAppPrivkey);
      }
    });
    if (doProofs) await tx3.prove();
    await tx3.send().wait();
  } catch (err) {
    console.log(err);
    return;
  }

  console.log('Calculating results...😱');
  try {
    const tx4 = await Mina.transaction(player2Acc, () => {
      zkAppInstance.winsOdd();
      let userParty = Party.createUnsigned(player2Acc.toPublicKey());
      userParty.balance.addInPlace(new UInt64(honeypot));
      if (!doProofs) {
        zkAppInstance.sign(zkAppPrivkey);
      }
    });
    if (doProofs) await tx4.prove();
    await tx4.send().wait();
    console.log('correct!');
    console.log(
      'Player balance after correct guess ',
      Mina.getBalance(player2Acc.toPublicKey()).toString()
    );
    console.log(
      'zkApp balance after payout: ',
      Mina.getBalance(zkAppAddress).toString()
    );
  } catch (e) {
    console.log(e);
    console.log('wrong commitments');
  }
}

(async function () {
  await run();
  await shutdown();
})();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
