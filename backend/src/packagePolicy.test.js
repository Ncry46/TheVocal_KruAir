import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    isHomeworkNote,
    packageHoursLeft,
    shouldNotifyLowHours,
} from './packagePolicy.js';

describe('packageHoursLeft', () => {
    it('returns remaining hours', () => {
        assert.equal(packageHoursLeft(10, 3), 7);
        assert.equal(packageHoursLeft(5, 8), 0);
    });
});

describe('shouldNotifyLowHours', () => {
    it('notifies when crossing the low-hours threshold', () => {
        assert.equal(shouldNotifyLowHours(5, 2), true);
        assert.equal(shouldNotifyLowHours(3, 1), true);
    });

    it('does not notify when already low', () => {
        assert.equal(shouldNotifyLowHours(2, 1), false);
        assert.equal(shouldNotifyLowHours(1, 0), true);
    });

    it('notifies when hours are exhausted', () => {
        assert.equal(shouldNotifyLowHours(1, 0), true);
        assert.equal(shouldNotifyLowHours(0, 0), false);
    });
});

describe('isHomeworkNote', () => {
    it('detects teacher homework notes', () => {
        assert.equal(isHomeworkNote('ฝึก C3–C5 ทุกวัน'), true);
        assert.equal(isHomeworkNote('บันทึกโดยครูแอร์'), false);
        assert.equal(isHomeworkNote(''), false);
    });
});
