export class SpecQRError extends Error {
  constructor(message, code) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class DataTooLongError extends SpecQRError {
  constructor(message) {
    super(message, "DATA_TOO_LONG");
  }
}

export class InvalidInputError extends SpecQRError {
  constructor(message) {
    super(message, "INVALID_INPUT");
  }
}

export class InvalidVersionError extends SpecQRError {
  constructor(message) {
    super(message, "INVALID_VERSION");
  }
}

export class InvalidModeError extends SpecQRError {
  constructor(message) {
    super(message, "INVALID_MODE");
  }
}

export class InvalidColorError extends SpecQRError {
  constructor(message) {
    super(message, "INVALID_COLOR");
  }
}

export class InvalidEciError extends SpecQRError {
  constructor(message) {
    super(message, "INVALID_ECI");
  }
}

export class InvalidGs1Error extends SpecQRError {
  constructor(message) {
    super(message, "INVALID_GS1");
  }
}

export class InvalidOutputError extends SpecQRError {
  constructor(message) {
    super(message, "INVALID_OUTPUT");
  }
}

export class InvalidCanvasTargetError extends SpecQRError {
  constructor(message) {
    super(message, "INVALID_CANVAS_TARGET");
  }
}
