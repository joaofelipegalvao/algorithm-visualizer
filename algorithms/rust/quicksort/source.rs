fn quicksort(lista: &mut Vec<i32>) {
    let fim = lista.len() as isize - 1;
    quicksort_rec(lista, 0, fim);
}

fn quicksort_rec(lista: &mut Vec<i32>, baixo: isize, alto: isize) {
    if baixo < alto {
        let p = particionar(lista, baixo, alto);
        quicksort_rec(lista, baixo, p - 1);
        quicksort_rec(lista, p + 1, alto);
    }
}

fn particionar(lista: &mut Vec<i32>, baixo: isize, alto: isize) -> isize {
    let pivo = lista[alto as usize];
    let mut i = baixo - 1;
    for j in baixo..alto {
        if lista[j as usize] <= pivo {
            i += 1;
            lista.swap(i as usize, j as usize);
        }
    }
    lista.swap((i + 1) as usize, alto as usize);
    i + 1
}
