const video = document.getElementById("video");
const registerBtn = document.getElementById("registerBtn");
const savedFaces = JSON.parse(localStorage.getItem("labeledFaceDescriptors"));
console.log(savedFaces);

let labeledFaceDescriptors = [];
let faceMatcher;

Promise.all([
  faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
]).then(startWebcam);


function startWebcam() {
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: false })
    .then((stream) => {
      video.srcObject = stream;
    })
    .catch((error) => {
      console.error("Error accessing webcam:", error);
    });
}

async function getLabeledFaceDescriptions() {
  const savedDescriptors = localStorage.getItem("labeledFaceDescriptors");
  if (savedDescriptors) {
    // Load from localStorage
    return JSON.parse(savedDescriptors).map((labelData) => {
      return new faceapi.LabeledFaceDescriptors(
        labelData.label,
        labelData.descriptors.map((desc) => new Float32Array(desc))
      );
    });
  }

  // If no saved descriptors, fetch from image labels (existing logic)
  const labels = ["Patriche", "Gea", "Ahdee"];
  return Promise.all(
    labels.map(async (label) => {
      const descriptions = [];
      for (let i = 1; i <= 2; i++) {
        const imgUrl = `./labels/${label}/${i}.png`;
        const img = await faceapi.fetchImage(imgUrl);
        const detection = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (!detection) {
          console.warn(`No face detected for ${label} image ${i}`);
          continue;
        }
        descriptions.push(detection.descriptor);
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    })
  );
}

video.addEventListener("play", async () => {
  labeledFaceDescriptors = await getLabeledFaceDescriptions();
  faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.appendChild(canvas);

  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video)
      .withFaceLandmarks()
      .withFaceDescriptors();

    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    resizedDetections.forEach((detection) => {
      const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
      const box = detection.detection.box;
      const drawBox = new faceapi.draw.DrawBox(box, { label: bestMatch.toString() });
      drawBox.draw(canvas);
    });
  }, 100);
});

// Register New Face Function
registerBtn.addEventListener("click", async () => {
  const detection = await faceapi
    .detectSingleFace(video)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    alert("No face detected. Please try again.");
    return;
  }

  const name = prompt("Enter the person's name:");
  if (!name) {
    alert("Name is required.");
    return;
  }

  // Create or update the face descriptor for the name
  const existingDescriptor = labeledFaceDescriptors.find(
    (desc) => desc.label === name
  );

  if (existingDescriptor) {
    existingDescriptor.descriptors.push(detection.descriptor);
  } else {
    labeledFaceDescriptors.push(
      new faceapi.LabeledFaceDescriptors(name, [detection.descriptor])
    );
  }

  // Update the matcher
  faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

  // Save to localStorage
  localStorage.setItem(
    "labeledFaceDescriptors",
    JSON.stringify(
      labeledFaceDescriptors.map((desc) => ({
        label: desc.label,
        descriptors: desc.descriptors.map((descriptor) => Array.from(descriptor)),
      }))
    )
  );

  alert(`${name} has been registered!`);
});
