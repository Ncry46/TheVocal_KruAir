import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pick, requiredPersonNames } from './lang.js';

describe('requiredPersonNames', () => {
    it('rejects missing English name', () => {
        assert.throws(
            () => requiredPersonNames({
                name: 'สมชาย ใจดี',
                nickname: 'มิ้นท์',
                nameEn: '',
                nicknameEn: 'Mint',
            }),
            /ไทยและภาษาอังกฤษ/,
        );
    });

    it('returns trimmed Thai and English names', () => {
        const names = requiredPersonNames({
            name: ' สมชาย ใจดี ',
            nameEn: ' Somchai Jaidee ',
            nickname: ' มิ้นท์ ',
            nicknameEn: ' Mint ',
        });
        assert.deepEqual(names, {
            name: 'สมชาย ใจดี',
            nameEn: 'Somchai Jaidee',
            nickname: 'มิ้นท์',
            nicknameEn: 'Mint',
        });
    });
});

describe('pick person name', () => {
    const row = {
        name: 'สมชาย ใจดี',
        name_en: 'Somchai Jaidee',
        nickname: 'มิ้นท์',
        nickname_en: 'Mint',
    };

    it('uses English when language is en', () => {
        assert.equal(pick(row, 'name', 'en'), 'Somchai Jaidee');
        assert.equal(pick(row, 'nickname', 'en'), 'Mint');
    });

    it('falls back to Thai when English is empty', () => {
        assert.equal(pick({ name: 'สมชาย ใจดี', name_en: null }, 'name', 'en'), 'สมชาย ใจดี');
    });
});
