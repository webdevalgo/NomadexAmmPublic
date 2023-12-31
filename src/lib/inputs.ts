export function onNumberKeyPress(event: KeyboardEvent) {
    const element = <HTMLInputElement>event.target;
    if (!element) return;
    setTimeout(() => {
        const value = element.value;
        if (value.match(/^0\d+([.]\d+)?$/)) {
            element.value = '';
            element.value = Number(value).toString();
        }
    }, 10);
}