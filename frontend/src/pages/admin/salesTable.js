export const SALES_PAGE_SIZE = 10;

export function saleInPeriod(sale, period, anchor) {
    const paidAt = new Date(sale.paidAt);
    if (period === 'daily') {
        return paidAt.getFullYear() === anchor.getFullYear()
            && paidAt.getMonth() === anchor.getMonth()
            && paidAt.getDate() === anchor.getDate();
    }
    if (period === 'yearly') {
        return paidAt.getFullYear() === anchor.getFullYear();
    }
    return paidAt.getFullYear() === anchor.getFullYear()
        && paidAt.getMonth() === anchor.getMonth();
}

export function filterSalesByPeriod(sales, period) {
    const list = sales ?? [];
    const anchor = list[0]?.paidAt ? new Date(list[0].paidAt) : null;
    if (!anchor) {
        return list;
    }
    return list.filter((sale) => saleInPeriod(sale, period, anchor));
}

export function paginateSales(sales, page, pageSize = SALES_PAGE_SIZE) {
    const totalPages = Math.max(1, Math.ceil(sales.length / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    return {
        totalPages,
        safePage,
        rows: sales.slice(start, start + pageSize),
        showPagination: sales.length > pageSize,
    };
}
