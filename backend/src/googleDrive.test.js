import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { safeDriveFolderName } from './googleDrive.js';

describe('safeDriveFolderName', () => {
    it('strips path-hostile characters and trims', () => {
        assert.equal(safeDriveFolderName('น้องมิ้นท์'), 'น้องมิ้นท์');
        assert.equal(safeDriveFolderName('a/b\\c:d'), 'a-b-c-d');
        assert.equal(safeDriveFolderName('  '), 'student');
        assert.equal(safeDriveFolderName(''), 'student');
    });
});
