fn maior(lista: &[i32]) -> i32 {
    if lista.len() == 1 {
        lista[0]
    } else {
        let sub_maior = maior(&lista[1..]);
        if lista[0] > sub_maior {
            lista[0]
        } else {
            sub_maior
        }
    }
}

fn main() {
    println!("{}", maior(&[3, 7, 2, 9, 4]));
}
