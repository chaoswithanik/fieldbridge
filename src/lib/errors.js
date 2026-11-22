export class AppError extends Error {
  constructor(status, message, fields = undefined) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
