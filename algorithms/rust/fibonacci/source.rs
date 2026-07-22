fn fib(n: u64) -> u64 {
    if n <= 1 {
        return n;
    }

    let a = fib(n - 1);
    let b = fib(n - 2);

    a + b
}
