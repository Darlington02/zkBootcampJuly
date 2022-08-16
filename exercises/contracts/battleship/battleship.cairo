## I AM NOT DONE

%lang starknet
from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.uint256 import Uint256, uint256_le, uint256_unsigned_div_rem, uint256_sub
from starkware.starknet.common.syscalls import get_caller_address
from starkware.cairo.common.math import unsigned_div_rem, assert_le_felt, assert_le
from starkware.cairo.common.alloc import alloc
from starkware.cairo.common.hash_state import hash_init, hash_update 
from starkware.cairo.common.bitwise import bitwise_and, bitwise_xor

struct Square:    
    member square_commit: felt
    member square_reveal: felt
    member shot: felt
end

struct Player:    
    member address: felt
    member points: felt
    member revealed: felt
end

struct Game:        
    member player1: Player
    member player2: Player
    member next_player: felt
    member last_move: (felt, felt)
    member winner: felt
end

@storage_var
func grid(game_idx : felt, player : felt, x : felt, y : felt) -> (square : Square):
end

@storage_var
func games(game_idx : felt) -> (game_struct : Game):
end

@storage_var
func game_counter() -> (game_counter : felt):
end

func hash_numb{pedersen_ptr : HashBuiltin*}(numb : felt) -> (hash : felt):

    alloc_locals
    
    let (local array : felt*) = alloc()
    assert array[0] = numb
    assert array[1] = 1
    let (hash_state_ptr) = hash_init()
    let (hash_state_ptr) = hash_update{hash_ptr=pedersen_ptr}(hash_state_ptr, array, 2)   
    tempvar pedersen_ptr :HashBuiltin* = pedersen_ptr       
    return (hash_state_ptr.current_hash)
end


## Provide two addresses
@external
func set_up_game{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(player1 : felt, player2 : felt):
    let (gc) = game_counter.read()
    let newGc = gc + 1
    let firstPlayer = Player(player1, 0, 0)
    let secondPlayer = Player(player2, 0, 0)
    let gameinit = Game(firstPlayer, secondPlayer, 0, (0,0), 0)
    games.write(gc, gameinit)
    game_counter.write(newGc)
    return ()
end

@view 
func check_caller{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(caller : felt, game : Game) -> (valid : felt):
    if caller == game.player1.address:
        return(1) 
    end
    if caller == game.player2.address:
        return(1)
    end
    return(0) 
end

@view
func check_hit{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*}(square_commit : felt, square_reveal : felt) -> (hit : felt):
    let (hashedReveal) = hash_numb(square_reveal)
    if hashedReveal == square_commit:
        let (q, r) = unsigned_div_rem(square_reveal, 2)
        if r == 1:
            return(1)
        end
        return(0)
    end
    return(0)
end

@external
func bombard{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*}(game_idx : felt, x : felt, y : felt, square_reveal : felt):
    alloc_locals
    let (game) = games.read(game_idx)
    let (caller) = get_caller_address()

    # check that the caller is a valaid player
    let (valid_caller) = check_caller(caller,game)
    assert valid_caller = 1

    # confirm that game winner has not been set
    assert game.winner = 0

    #check who is the caller
    let player1 = game.player1.address
    let player2 = game.player2.address
    local current_player 
    local other_player
    
    if caller == player1:
        current_player = caller
        other_player = player2
    else:
        current_player = caller
        other_player = player1
    end


    # update the move by the caller
    let (square) = grid.read(game_idx, current_player, x, y)
    let new_square = Square(square.square_commit, square.square_reveal, 1)
    grid.write(game_idx, current_player, x, y, new_square)

    #this is the first move
    if game.next_player == 0:
        # This is the first move. Update the game and return
        let updatedGame = Game(game.player1,game.player2, other_player, (x,y), game.winner)
        games.write(game_idx, updatedGame)
        return ()
    end

    # if it is not first move it will assert that is the right player and call check_hit. 
    if game.next_player != 0:
        assert game.next_player = current_player
        let (last_square) = grid.read(game_idx, other_player, game.last_move[0], game.last_move[1])
        let (isHit) = check_hit(last_square.square_commit, square_reveal)

        # if the battleship has been hit, update points for the current player and then update game
        if isHit == 1:
            if game.player1.address == current_player:
                let points = game.player1.points + 1
                let player1Obj = Player(game.player1.address, points, game.player1.revealed)                    
                if points == 4:
                    let updatedGame = Game(player1Obj,game.player2,other_player, (x,y), game.player1.address)
                    games.write(game_idx, updatedGame)
                    return()
                else:
                    let updatedGame = Game(player1Obj,game.player2,other_player, (x,y), game.winner)
                    games.write(game_idx, updatedGame)
                    return()
                end
            end


            if game.player2.address == current_player:
                let points = game.player2.points + 1
                let player2Obj = Player(game.player2.address, points, game.player2.revealed)                    

                if points == 4:
                    let updatedGame = Game(game.player1,player2Obj,other_player, (x,y), game.player2.address)
                    games.write(game_idx, updatedGame)
                    return ()
                else:
                    let updatedGame = Game(game.player1,player2Obj,other_player, (x,y), game.winner)
                    games.write(game_idx, updatedGame)
                    return ()
                end
            end
            return()         
        else:
            # update the game without updating any points
            let updatedGame = Game(game.player1,game.player2,other_player, (x,y), game.winner)
            games.write(game_idx, updatedGame)
            return ()
        end
    end
    return()
end



## Check malicious call
@external
func add_squares{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(idx : felt, game_idx : felt, hashes_len : felt, hashes : felt*, player : felt, x: felt, y: felt):
    let (game) = games.read(game_idx)
    let (caller) = get_caller_address()
    # check caller's eligibility
    let (eligibility) = check_caller(caller, game)
    load_hashes(idx, game_idx, hashes_len, hashes, player, x, y)
    return ()
end

## loops until array length
func load_hashes{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(idx : felt, game_idx : felt, hashes_len : felt, hashes : felt*, player : felt, x: felt, y: felt):
    return ()
end
