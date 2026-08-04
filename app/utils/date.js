function convertirFechaHoraUTC(fecha, hora) {
  const fechaHora = new Date(`${fecha.trim()}T${hora.trim()}:00.000Z`);
  return fechaHora;
}

export const DateUtils = {
  convertirFechaHoraUTC,
};
