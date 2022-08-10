import {
    Field,
    PublicKey,
    SmartContract,
    state,
    State,
    method,
    UInt64,
    Poseidon,
} from 'snarkyjs';

export class Odds extends SmartContract {
  // on-chain state definitions
  @state(UInt64) honeypot = State<UInt64>();
  @state(Field) player1Odd = State<Field>();
  @state(Field) player2Odd = State<Field>();
  @state(Field) player1commitment = State<Field>();
  @state(Field) player2commitment = State<Field>();

  @method init(
    initialBalance: UInt64,
    _honeypot: Field,
  ) {
    // initial values on on-chain states
    this.balance.addInPlace(initialBalance);
    this.honeypot.set(new UInt64(_honeypot));
    this.player1Odd.set(Field.zero)
    this.player2Odd.set(Field.zero)
  }

  @method player1SelectOdd(_player1Odd: Field) {
    // check that number falls in range
    _player1Odd.assertGte(2)
    _player1Odd.assertLte(100)
        
    // set player1odd on-chain state
    this.player1Odd.set(_player1Odd);

    // subtract pot value from first player
    let potValue = this.honeypot.get();
    this.balance.addInPlace(potValue);

    // hash and store his commitment
    let hash = Poseidon.hash([_player1Odd]);
    this.player1commitment.set(hash);
  }

  @method player2SelectOdd(_player2Odd: Field) {
    // check that number falls in range
    _player2Odd.assertGte(2)
    _player2Odd.assertLte(100)

    // set player2odd on-chain state
    this.player2Odd.set(_player2Odd);

    // hash and store his commitment
    let hash = Poseidon.hash([_player2Odd]);
    this.player2commitment.set(hash);
  }

  @method winsOdd() {
    // extract the odds
    let player1odd = this.player1Odd.get();
    let player2odd = this.player2Odd.get();

    // compute the hash of player1 odd
    let player1hash = Poseidon.hash([player1odd]);
    let player2hash = Poseidon.hash([player2odd]);

    // extract the commitment for comparison
    let player1commitment = this.player1commitment.get();
    let player2commitment = this.player2commitment.get();

    // assert that there is no foul play
    player1hash.assertEquals(player1commitment);
    player2hash.assertEquals(player2commitment);

    // if odds are equal, player2 wins honeypot
    let reward = this.honeypot.get();
    player1odd.assertEquals(player2odd);
    this.balance.subInPlace(reward);
  }
}
