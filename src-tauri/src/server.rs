use std::net::TcpListener;

pub fn port_in_use(port: u16) -> bool {
    TcpListener::bind(format!("127.0.0.1:{}", port)).is_err()
}

/// Scan up to 100 ports starting from `start` and return the first free one.
/// Returns an error string if no free port is found in that range.
pub fn find_free_port(start: u16) -> Result<u16, String> {
    for port in start..=start.saturating_add(99) {
        if !port_in_use(port) {
            // Verify the port is still free immediately before returning it
            if TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok() {
                return Ok(port);
            }
        }
    }
    Err(format!(
        "No free port found in range {}..={}",
        start,
        start.saturating_add(99)
    ))
}
