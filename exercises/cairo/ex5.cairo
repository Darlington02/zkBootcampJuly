## I AM NOT DONE

## Implement a funcion that returns: 
## - 1 when magnitudes of inputs are equal
## - 0 otherwise
func abs_eq(x : felt, y : felt) -> (bit : felt):
    if x == y:
        return (1)
    end
    if x == -y:
        return (1)
    end
    if -x == y:
        return (1)
    end
    if -x == -y:
        return(1)
    end
    return(0)
end
