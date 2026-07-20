fn fat(x: u64) -> u64 {
    if x == 1 {
        1
    } else {
        x * fat(x - 1)
    }
}

fn main() {
    println!("{}", fat(3));
}
