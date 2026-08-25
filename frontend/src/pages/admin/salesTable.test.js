import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filterSalesByPeriod, paginateSales, SALES_PAGE_SIZE } from './salesTable.js';

function sale(iso) {
    return { paidAt: new Date(iso).toISOString(), student: iso };
}

describe('filterSalesByPeriod', () => {
    const sales = [
        sale('2026-08-25T10:00:00'),
        sale('2026-08-25T08:00:00'),
        sale('2026-08-24T18:00:00'),
        sale('2026-07-02T12:00:00'),
        sale('2025-12-31T23:00:00'),
    ];

    it('keeps only the latest day for daily', () => {
        const rows = filterSalesByPeriod(sales, 'daily');
        assert.equal(rows.length, 2);
        assert.equal(rows[0].student, '2026-08-25T10:00:00');
        assert.equal(rows[1].student, '2026-08-25T08:00:00');
    });

    it('keeps the latest month for monthly', () => {
        const rows = filterSalesByPeriod(sales, 'monthly');
        assert.equal(rows.length, 3);
    });

    it('keeps the latest year for yearly', () => {
        const rows = filterSalesByPeriod(sales, 'yearly');
        assert.equal(rows.length, 4);
    });

    it('returns all rows when paidAt is missing', () => {
        const rows = [{ student: 'a' }, { student: 'b' }];
        assert.deepEqual(filterSalesByPeriod(rows, 'daily'), rows);
    });
});

describe('paginateSales', () => {
    const sales = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }));

    it('pages 10 rows and shows pagination when over the limit', () => {
        const first = paginateSales(sales, 1);
        assert.equal(SALES_PAGE_SIZE, 10);
        assert.equal(first.totalPages, 2);
        assert.equal(first.safePage, 1);
        assert.equal(first.rows.length, 10);
        assert.equal(first.showPagination, true);
        assert.equal(first.rows[0].id, 1);
        assert.equal(first.rows[9].id, 10);

        const second = paginateSales(sales, 2);
        assert.equal(second.safePage, 2);
        assert.equal(second.rows.length, 2);
        assert.deepEqual(second.rows.map((row) => row.id), [11, 12]);
    });

    it('clamps an out-of-range page', () => {
        const page = paginateSales(sales, 99);
        assert.equal(page.safePage, 2);
        assert.equal(page.rows.length, 2);
    });

    it('hides pagination at 10 rows or fewer', () => {
        const page = paginateSales(sales.slice(0, 10), 1);
        assert.equal(page.showPagination, false);
        assert.equal(page.totalPages, 1);
    });
});
