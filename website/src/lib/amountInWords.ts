const SMALL = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function wholeNumberInWords(value: number): string {
    if (value < 20) return SMALL[value];
    if (value < 100) return `${TENS[Math.floor(value / 10)]}${value % 10 ? ` ${SMALL[value % 10]}` : ''}`;
    for (const [size, label] of [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand'], [100, 'Hundred']] as const) {
        if (value >= size) return `${wholeNumberInWords(Math.floor(value / size))} ${label}${value % size ? ` ${wholeNumberInWords(value % size)}` : ''}`;
    }
    return '';
}

/** Spell the same two-decimal rupee amount shown on receipts, including paise. */
export function amountInWords(amount?: number | null): string {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER / 100) return '';
    const formatted = new Intl.NumberFormat('en-US', { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    const [rupees, paise] = formatted.split('.').map(Number);
    return `Rupees ${wholeNumberInWords(rupees)}${paise ? ` and ${wholeNumberInWords(paise)} Paise` : ''} Only`;
}
