fn conta(lista: &[i32]) -> i32 {
    if lista.is_empty() {
        0
    } else {
        1 + conta(&lista[1..])
    }
}

fn main() {
    println!("{}", conta(&[2, 4, 6, 8]));
}
