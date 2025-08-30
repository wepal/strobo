export function createStroboEvaluation(frames) {
    // frames: list of ImageData (returned by getImageData)

    // using preallocated Mats to avoid memory problems with opencv.js
    let background;
    let framesRGB = [];
    let maxDiff;
    let maxAbsDiff;
    let diff;
    let absDiff;
    let absDiff3;
    let mask;
    let strobeMat;
    let strobeDisplay;
    let frame32F;

    function prepareEvaluation(frames) {
        console.log('prepareEvaluation...');

        const w = frames[0].width;
        const h = frames[0].height;

        console.log(`Video dimensions: ${frames.length}x(${w}x${h})`);
        const bytesOpenCv = frames.length * w * h * 3;
        console.log(`Approx. memory for OpenCV Mats: ${Math.round(bytesOpenCv / 1024 / 1024)} MB`);

        // convert to RGB cv.Mat
        for (let i = 0; i < frames.length; i++) {
            const imageData = frames[i];
            let matRGBA = cv.matFromImageData(imageData);
            frames[i] = null; // free as soon as possible to save memory
            let matRGB = new cv.Mat();
            cv.cvtColor(matRGBA, matRGB, cv.COLOR_RGBA2RGB);
            matRGBA.delete();
            framesRGB.push(matRGB);
        }
        frames = null;

        frame32F = new cv.Mat(h, w, cv.CV_32FC3);
        background = new cv.Mat.zeros(h, w, cv.CV_32FC3);
        calcBackground();
        maxDiff = new cv.Mat.zeros(h, w, cv.CV_32FC3);
        maxAbsDiff = new cv.Mat.zeros(h, w, cv.CV_32F);
        diff = new cv.Mat(h, w, cv.CV_32FC3);
        absDiff = new cv.Mat(h, w, cv.CV_32F);
        absDiff3 = new cv.Mat(h, w, cv.CV_32FC3);
        mask = new cv.Mat(h, w, cv.CV_8U);
        strobeMat = new cv.Mat(h, w, cv.CV_32FC3);
        strobeDisplay = new cv.Mat(h, w, cv.CV_8UC3);
    }

    function calcBackground() {
        framesRGB.forEach(f => {
            f.convertTo(frame32F, cv.CV_32F);
            cv.add(background, frame32F, background);
        });

        // divide background by number of frames
        const m = 1.0 / framesRGB.length;
        const scalar = new cv.Scalar(m, m, m)
        const scalarMat = new cv.Mat(background.rows, background.cols, background.type(), scalar);
        cv.multiply(background, scalarMat, background);
        scalarMat.delete();
    }

    function updateStrobe(canvas, interval) {
        console.log('updateStrobe...');
        if (framesRGB.length === 0) return;

        maxDiff.setTo(new cv.Scalar(0, 0, 0));
        maxAbsDiff.setTo(new cv.Scalar(0));

        for (let i = 0; i < framesRGB.length; i += interval) {
            const frame = framesRGB[i];
            frame.convertTo(frame32F, cv.CV_32F);
            cv.subtract(frame32F, background, diff);
            cv.absdiff(frame32F, background, absDiff3);
            cv.cvtColor(absDiff3, absDiff, cv.COLOR_RGB2GRAY);
            cv.compare(absDiff, maxAbsDiff, mask, cv.CMP_GT);
            diff.copyTo(maxDiff, mask);
            absDiff.copyTo(maxAbsDiff, mask);
        }

        background.copyTo(strobeMat);
        cv.add(strobeMat, maxDiff, strobeMat);

        strobeMat.convertTo(strobeDisplay, cv.CV_8U);
        cv.imshow(canvas, strobeDisplay);

        console.log('updateStrobe finished.');
    }

    prepareEvaluation(frames);

    return {
        updateStrobe
    };
}