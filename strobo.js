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
    let strobe;
    let strobe8U;
    let strobe8UC4;
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
        strobe = new cv.Mat(h, w, cv.CV_32FC3);
        strobe8U = new cv.Mat(h, w, cv.CV_8UC3);
        strobe8UC4 = new cv.Mat(h, w, cv.CV_8UC4);
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

    function computeStrobeImage(interval, offset=0) {
        if (framesRGB.length === 0) return [];

        maxDiff.setTo(new cv.Scalar(0, 0, 0));
        maxAbsDiff.setTo(new cv.Scalar(0));

        for (let i = offset; i < framesRGB.length; i += interval) {
            const frame = framesRGB[i];
            frame.convertTo(frame32F, cv.CV_32F);
            cv.subtract(frame32F, background, diff);
            cv.absdiff(frame32F, background, absDiff3);
            cv.cvtColor(absDiff3, absDiff, cv.COLOR_RGB2GRAY);
            cv.compare(absDiff, maxAbsDiff, mask, cv.CMP_GT);
            diff.copyTo(maxDiff, mask);
            absDiff.copyTo(maxAbsDiff, mask);
        }

        background.copyTo(strobe);
        cv.add(strobe, maxDiff, strobe);

        strobe.convertTo(strobe8U, cv.CV_8U);
        cv.cvtColor(strobe8U, strobe8UC4, cv.COLOR_RGB2RGBA);

        const array = new Uint8ClampedArray(strobe8UC4.data);
        const imageData = new ImageData(array, strobe8UC4.cols, strobe8UC4.rows);
        return imageData;
    }

    function computeStrobeSeries(interval) {
        const series = [];
        for (let offset = 0; offset < interval; offset++) {
            const imageData = computeStrobeImage(interval, offset);
            series.push(imageData);
        }
        return series;
    }

    function destroy() {
        framesRGB.forEach(f => f.delete());
        framesRGB = [];
        background.delete();
        maxDiff.delete();
        maxAbsDiff.delete();
        diff.delete();
        absDiff.delete();
        absDiff3.delete();
        mask.delete();
        strobeMat.delete();
        strobeDisplay.delete();
        frame32F.delete();
    }

    prepareEvaluation(frames);

    return {
        computeStrobeImage,
        computeStrobeSeries,
        destroy
    };
}