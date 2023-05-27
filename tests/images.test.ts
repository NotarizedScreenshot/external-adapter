import {expect} from 'chai';
import {makeStampedImage} from "../src/helpers/images";

describe('images', () => {
        it('puts SVG stamp over an image', async () => {
            const buffer: Buffer = (await makeStampedImage('public/images/wait.png'))!;
            expect(buffer.length).to.be.greaterThan(100_000);
        });
    }
)
