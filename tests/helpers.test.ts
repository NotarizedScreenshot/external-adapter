import chai, { expect } from 'chai';
import { isValidUint64, makeTweetUrlWithId } from '../src/helpers';

describe('helper test', () => {
  describe('test isValidUint64', () => {
    it('not BigInt: text: false', () => {
      expect(isValidUint64('asd')).to.be.false;
      expect(isValidUint64('asd1234')).to.be.false;
    });

    it('not BigInt: undefined or null: false', () => {
      const undef: any = undefined;
      expect(isValidUint64(undef)).to.be.false;
      const nullish: any = null;
      expect(isValidUint64(nullish)).to.be.false;
    });

    it('is BigInt and exceed uint64: false', () => {
      const value0 = '1' + '0'.repeat(20); //100000000000000000000
      const value1 = '1' + '0'.repeat(19) + '1'; //100000000000000000001
      const value2 = '9'.repeat(20);
      expect(isValidUint64(value0)).to.be.false;
      expect(isValidUint64(value1)).to.be.false;
      expect(isValidUint64(value2)).to.be.false;
    });

    it('is BigInt negative, not Uint64: false', () => {
      expect(isValidUint64('-1')).to.be.false;
      expect(isValidUint64(-1)).to.be.false;
    });

    it('is BigInt: true', () => {
      expect(isValidUint64('1')).to.be.true;
      expect(isValidUint64(1)).to.be.true;
      const value0 = '1'.repeat(20);
      expect(isValidUint64(value0)).to.be.true;
      const value1 = '9'.repeat(19);
      expect(isValidUint64(value1)).to.be.true;
    });
  });
  describe('test makeTweetUrlWithId', () => {
    //TODO: write tests
  });
});
