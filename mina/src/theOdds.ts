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
  @state(PublicKey as any) user1 = State<PublicKey>();
  @state(PublicKey as any) user2 = State<PublicKey>();
  @state(UInt64) honeypot = State<UInt64>();
  @state(Field) minOdd = State<Field>();
  @state(Field) maxOdd = State<Field>();
  @state(Field) player1Odd = State<Field>();
  @state(Field) player2Odd = State<Field>();
  @state(Field) player1commitment = State<Field>();
  @state(Field) player2commitment = State<Field>();

  @method init(
    _user1: PublicKey,
    _user2: PublicKey,
    initialBalance: Field,
    _minOdd: Field,
    _maxOdd: Field
  ) {
    // initial values on on-chain states
    this.user1.set(_user1);
    this.user2.set(_user2);
    this.honeypot.set(new UInt64(initialBalance));
    this.minOdd.set(Field(_minOdd));
    this.maxOdd.set(Field(_maxOdd));
  }

  @method player1SelectOdd(_player1Odd: Field) {
    // check that selected odd falls in range of odds
    let minOdd = this.minOdd.get();
    let maxOdd = this.maxOdd.get();
    _player1Odd.assertGte(minOdd);
    _player1Odd.assertLte(maxOdd);

    // set player1odd on-chain state
    this.player1Odd.set(Field(_player1Odd));

    // hash and store his commitment
    let player1 = this.player1Odd.get();
    let hash = Poseidon.hash([player1]);
    this.player1commitment.set(hash);
  }

  @method player2SelectOdd(_player2Odd: Field) {
    // check that selected odd falls in range of odds
    let minOdd = this.minOdd.get();
    let maxOdd = this.maxOdd.get();
    _player2Odd.assertGte(minOdd);
    _player2Odd.assertLte(maxOdd);

    // set player2odd on-chain state
    this.player2Odd.set(Field(_player2Odd));

    // hash and store his commitment
    let player2 = this.player2Odd.get();
    let hash = Poseidon.hash([player2]);
    this.player2commitment.set(hash);
  }

  @method winsOdd() {
    // extract the odds
    let player1odd = this.player1Odd.get();
    let player2odd = this.player2Odd.get();

    // compute the hashes of the odds
    let player1hash = Poseidon.hash([player1odd]);
    let player2hash = Poseidon.hash([player2odd]);

    // extract the commitments for comparison
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
