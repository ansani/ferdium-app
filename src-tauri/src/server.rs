use std::net::TcpListener;

pub fn port_in_use(port: u16) -> bool {
    TcpListener::bind(format!("127.0.0.1:{}", port)).is_err()
}

pub fn find_free_port(start: u16) -> u16 {
    let mut port = start;
    while port_in_use(port) && port < start + 10 {
        port += 1;
    }
    port
}
