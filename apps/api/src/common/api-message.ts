// Return this from a handler to set the envelope message; a plain return is sent with 'OK'.
export class ApiMessage<T> {
  constructor(
    readonly data: T,
    readonly message: string,
  ) {}
}
