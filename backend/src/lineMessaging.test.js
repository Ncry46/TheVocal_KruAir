import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    formatLineNotifyMessage,
    getLineMessagingConfig,
    isLineMessagingConfigured,
} from './lineMessaging.js';

describe('getLineMessagingConfig', () => {
    it('is unconfigured without access token', () => {
        assert.equal(isLineMessagingConfigured({ LINE_CHANNEL_ACCESS_TOKEN: '' }), false);
        assert.equal(getLineMessagingConfig({}).configured, false);
    });

    it('is configured when access token is set', () => {
        assert.equal(isLineMessagingConfigured({ LINE_CHANNEL_ACCESS_TOKEN: 'token' }), true);
    });
});

describe('formatLineNotifyMessage', () => {
    it('joins title and body', () => {
        assert.equal(formatLineNotifyMessage('หัวข้อ', 'รายละเอียด'), 'หัวข้อ\nรายละเอียด');
    });
});
