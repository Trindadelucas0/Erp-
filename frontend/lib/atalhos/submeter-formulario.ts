export function submeterFormularioPorId(id: string): void {
  const form = document.getElementById(id)
  if (form instanceof HTMLFormElement) {
    form.requestSubmit()
  }
}
