function convertirFechaHoraUTC(fecha, hora) {
    let fechaHoraSQL;
     const fechaHora = new Date(`${fecha.trim()}T${hora.trim()}:00.000Z`);
    console.log(fechaHora);
    // Formatea a string compatible con SQL DATETIME (YYYY-MM-DD HH:MM:SS)
    fechaHoraSQL = fechaHora.toISOString().slice(0, 19).replace('T', ' ');
    return fechaHoraSQL;
}

export const DateUtils = {
    convertirFechaHoraUTC
}
