fn saudacao(nome: &str) {
    println!("Olá, {}!", nome);
    saudacao2(nome);
    println!("preparando para dizer tchau...");
    tchau();
}

fn saudacao2(nome: &str) {
    println!("Como vai {}?", nome);
}

fn tchau() {
    println!("Ok, tchau!");
}

fn main() {
    saudacao("maggie");
}
