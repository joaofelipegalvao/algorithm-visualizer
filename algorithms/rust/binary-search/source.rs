fn busca_binaria(lista: &[i32], alvo: i32) -> Option<usize> {
    busca_binaria_com_offset(lista, alvo, 0)
}

fn busca_binaria_com_offset(lista: &[i32], alvo: i32, offset: usize) -> Option<usize> {
    if lista.is_empty() {
        return None;
    }

    let meio = lista.len() / 2;
    if lista[meio] == alvo {
        Some(offset + meio)
    } else if lista[meio] < alvo {
        busca_binaria_com_offset(&lista[meio + 1..], alvo, offset + meio + 1)
    } else {
        busca_binaria_com_offset(&lista[..meio], alvo, offset)
    }
}

fn main() {
    let numeros = vec![1, 3, 5, 7, 9, 11, 13];
    match busca_binaria(&numeros, 9) {
        Some(indice) => println!("encontrado no índice {}", indice),
        None => println!("não encontrado"),
    }
}
