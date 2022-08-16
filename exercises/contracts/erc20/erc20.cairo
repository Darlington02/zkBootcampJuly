
%lang starknet
from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.cairo.common.uint256 import Uint256, uint256_le, uint256_unsigned_div_rem, uint256_sub
from starkware.starknet.common.syscalls import get_caller_address, get_contract_address
from starkware.cairo.common.math import unsigned_div_rem, assert_le_felt

from starkware.cairo.common.math import (
    assert_not_zero,
    assert_not_equal,
    assert_nn,
    assert_le,
    assert_lt,    
    assert_in_range,
)


from exercises.contracts.erc20.ERC20_base import (
    ERC20_name,
    ERC20_symbol,
    ERC20_totalSupply,
    ERC20_decimals,
    ERC20_balanceOf,
    ERC20_allowance,
    ERC20_mint,

    ERC20_initializer,       
    ERC20_transfer,    
    ERC20_burn
)

@storage_var
    func admin() -> (admin_address: felt):
end

@storage_var 
    func whitelist(account) -> (status: felt):
end

#
# Constructor
#

@constructor
func constructor{
        syscall_ptr: felt*, 
        pedersen_ptr: HashBuiltin*,
        range_check_ptr
    }(
        name: felt,
        symbol: felt,
        initial_supply: Uint256,
        recipient: felt
    ):
    ERC20_initializer(name, symbol, initial_supply, recipient) 
    admin.write(recipient) 
    return ()
end

# 
# Function for converting from Uint to felt
# 

func to_felt{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(value : Uint256) -> (res : felt):
    let res = value.low + value.high * (2 ** 128)
    return (res)
end

#
# Getters
#

@view
func name{
        syscall_ptr : felt*,
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }() -> (name: felt):
    let (name) = ERC20_name()
    return (name)
end


@view
func symbol{
        syscall_ptr : felt*,
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }() -> (symbol: felt):
    let (symbol) = ERC20_symbol()
    return (symbol)
end

@view
func totalSupply{
        syscall_ptr : felt*, 
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }() -> (totalSupply: Uint256):
    let (totalSupply: Uint256) = ERC20_totalSupply()
    return (totalSupply)
end

@view
func decimals{
        syscall_ptr : felt*, 
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }() -> (decimals: felt):
    let (decimals) = ERC20_decimals()
    return (decimals)
end

@view
func balanceOf{
        syscall_ptr : felt*, 
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }(account: felt) -> (balance: Uint256):
    let (balance: Uint256) = ERC20_balanceOf(account)
    return (balance)
end

@view
func allowance{
        syscall_ptr : felt*, 
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }(owner: felt, spender: felt) -> (remaining: Uint256):
    let (remaining: Uint256) = ERC20_allowance(owner, spender)
    return (remaining)
end

@view 
func get_admin{
        syscall_ptr : felt*,
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }() -> (admin_address: felt):
    let(admin_address) = admin.read()
    return (admin_address)
end

#
# Externals
#


@external
func transfer{
        syscall_ptr : felt*, 
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }(recipient: felt, amount: Uint256) -> (success: felt):
    # divide amount by 2 and check if remainder is zero to know if amount is even
    let (_amount) = to_felt(amount)
    let (x, r) = unsigned_div_rem(_amount, 2)
    # transfer tokens if r = 0, else fail.
    assert r = 0
    ERC20_transfer(recipient, amount)    
    return (1)
end

@external
func faucet{
        syscall_ptr : felt*, 
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }(amount:Uint256) -> (success: felt):
    # get caller address
    let (caller) = get_caller_address()
    # convert amount to felt for comparison
    let (_amount) = to_felt(amount)
    # check that amount is less than or equal to 10,000
    assert_le(_amount, 10000)
    # mint tokens
    ERC20_mint(caller, amount)
    return (1)
end


@external
func burn{
        syscall_ptr : felt*, 
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }(amount: Uint256) -> (success: felt): 
    alloc_locals  
    # get admin address
    let (owner) = get_admin()
    # divide _amount by 10 to get 10% of amount, since cairo has issues with decimals
    let (q, _) = uint256_unsigned_div_rem(amount, Uint256(10, 0))
    # transfer owner's percentage to owner's account
    ERC20_transfer(owner, q)
    # burn the rest
    let (account) = get_caller_address()
    let (burned_amount) = uint256_sub(amount, q)
    ERC20_burn(account, burned_amount)
    return (1)
end

@external
func request_whitelist{
        syscall_ptr : felt*,
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }() -> (level_granted: felt):
    # get caller address
    let (caller) = get_caller_address()
    # add to whitelist
    whitelist.write(caller, 1) 
    return(1)
end

@external
func check_whitelist{
        syscall_ptr : felt*,
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }(account: felt) -> (allowed_v: felt):
    let (whitelisted) = whitelist.read(account)
    if whitelisted == 1:
        return (1)
    end
    return (0)
end

@external
func exclusive_faucet{
        syscall_ptr : felt*,
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }(amount: Uint256) -> (success: felt):
    # get caller address
    let (caller) = get_caller_address()
    # check if caller is whitelisted
    let (allowed_v) = check_whitelist(caller)
    if allowed_v == 1:
        ERC20_mint(caller, amount)
        return (1)
    end
    return (0)
end