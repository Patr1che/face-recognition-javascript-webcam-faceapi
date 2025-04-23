// DOM references
const video = document.getElementById("video");
const registerBtn = document.getElementById("registerBtn");
const clearBtn = document.getElementById("clearBtn");

// Load previously saved face descriptors
let labeledFaceDescriptors = [];
let faceMatcher = null;

// Load face-api models
Promise.all([
  faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
]).then(startWebcam).then(loadSavedFaces);

// Start the webcam stream
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

// Load face descriptors from localStorage
async function loadSavedFaces() {
  const savedDescriptors = localStorage.getItem("labeledFaceDescriptors");
  if (savedDescriptors) {
    labeledFaceDescriptors = JSON.parse(savedDescriptors).map((labelData) => {
      return new faceapi.LabeledFaceDescriptors(
        labelData.label,
        labelData.descriptors.map((desc) => new Float32Array(desc))
      );
    });
    faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
    console.log(labeledFaceDescriptors)
  } else {
    labeledFaceDescriptors = [];
    faceMatcher = null;
  }
}

// On video play, start face detection loop
video.addEventListener("play", () => {
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
      if (faceMatcher) {
        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
        const box = detection.detection.box;
        const drawBox = new faceapi.draw.DrawBox(box, {
          label: bestMatch.toString(),
        });
        drawBox.draw(canvas);
      } else {
        const box = detection.detection.box;
        const drawBox = new faceapi.draw.DrawBox(box, {
          label: "Unregistered",
        });
        drawBox.draw(canvas);
      }
    });
  }, 100);
});

// Register New Face
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

  // Add or update existing descriptor
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

  // Update matcher
  faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

  // Save updated descriptors to localStorage
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
