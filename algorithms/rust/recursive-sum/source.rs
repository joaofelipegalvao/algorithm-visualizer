fn soma(lista: &[i32]) -> i32 {
    if lista.len() <= 1 {
        lista.iter().sum()
    } else {
        lista[0] + soma(&lista[1..])
    }
}

fn main() {
    println!("{}", soma(&[2, 4, 6]));
}
