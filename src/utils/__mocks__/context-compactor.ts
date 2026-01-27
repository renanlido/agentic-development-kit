export class ContextCompactor {
  getContextStatus = jest.fn()
  compact = jest.fn()
  summarize = jest.fn()
  createHandoffDocument = jest.fn()
}

export const contextCompactor = new ContextCompactor()
