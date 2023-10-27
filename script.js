const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const goldenRatio = 1.61803398875;

let segments = [];
let ghost = [];
let highlightedSegment = null;
let historyStack = [];
let currentHistoryPosition = -1;

function addCustomDivisionToDropdown() {
    const customValueInput = document.getElementById('customDivisionValueInput');
    const divisionTypeSelect = document.getElementById('divisionType');
    
    const customValue = parseInt(customValueInput.value);
    
    if (isNaN(customValue) || customValue <= 0) {
        alert("Please enter a valid custom division value.");
        return;
    }

    // Check if this custom value already exists in the dropdown
    for(let i = 0; i < divisionTypeSelect.options.length; i++) {
        if(divisionTypeSelect.options[i].value === customValue.toString()) {
            alert("This division value already exists in the dropdown.");
            return;
        }
    }

    const option = document.createElement('option');
    option.value = customValue;
    option.textContent = `Divide by ${customValue}`;
    divisionTypeSelect.appendChild(option);

    customValueInput.value = ''; // Clear the custom value input field
}


document.getElementById('divisionType').addEventListener('change', function() {
    const divisionType = document.getElementById('divisionType').value;
    const customInput = document.getElementById('customDivisionInput');
    if (divisionType === "custom") {
        customInput.style.display = 'inline-block';
    } else {
        customInput.style.display = 'none';
    }
});

function saveState() {
    // Remove states after the current position (for redo)
    if (currentHistoryPosition !== -1) {
        historyStack = historyStack.slice(0, currentHistoryPosition + 1);
    }
    
    // Save the current state
    historyStack.push(JSON.parse(JSON.stringify(segments)));
    currentHistoryPosition++;

    // Limit the history stack to some maximum size (optional, e.g., last 50 states)
    while (historyStack.length > 50) {
        historyStack.shift();
        currentHistoryPosition--;
    }
}

function undo() {
    if (currentHistoryPosition > 0) {
        currentHistoryPosition--;
        segments = JSON.parse(JSON.stringify(historyStack[currentHistoryPosition]));
        drawSegments();
    }
}

function redo() {
    if (currentHistoryPosition < historyStack.length - 1) {
        currentHistoryPosition++;
        segments = JSON.parse(JSON.stringify(historyStack[currentHistoryPosition]));
        drawSegments();
    }
}

function getSegmentDivisionValue(segment, isVertical) {
    const divisionType = document.getElementById('divisionType').value;
    if (divisionType === "goldenRatio") {
        return isVertical 
            ? segment.width / (1 + goldenRatio) 
            : segment.height / (1 + goldenRatio);
    } else if (divisionType === "custom") {
        const customDivisions = parseInt(document.getElementById('customDivisionInput').value);
        return isVertical ? segment.width / customDivisions : segment.height / customDivisions;
    } else {
        const divisions = parseInt(divisionType);
        return isVertical ? segment.width / divisions : segment.height / divisions;
    }
}

canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    const divisionTypeSelect = document.getElementById('divisionType');
    const currentIndex = divisionTypeSelect.selectedIndex;
    if (e.deltaY < 0 && currentIndex > 0) {
        // Scroll up
        divisionTypeSelect.selectedIndex = currentIndex - 1;
    } else if (e.deltaY > 0 && currentIndex < divisionTypeSelect.options.length - 1) {
        // Scroll down
        divisionTypeSelect.selectedIndex = currentIndex + 1;
    }
    divisionTypeSelect.dispatchEvent(new Event('change')); // Trigger change event
    checkForSegmentDivision(e.clientX, e.clientY); // Update the division preview
});

function updateCanvasDimensions(reset = false) {
    const newWidth = parseInt(document.getElementById('widthInput').value, 10);
    const newHeight = parseInt(document.getElementById('heightInput').value, 10);

    if (!reset && canvas.width !== 0 && canvas.height !== 0) {
        const widthRatio = newWidth / canvas.width;
        const heightRatio = newHeight / canvas.height;

        segments = segments.map(segment => ({
            x: segment.x * widthRatio,
            y: segment.y * heightRatio,
            width: segment.width * widthRatio,
            height: segment.height * heightRatio,
        }));
    } else {
        segments = [{
            x: 0,
            y: 0,
            width: newWidth,
            height: newHeight
        }];
    }

    canvas.width = newWidth;
    canvas.height = newHeight;

    drawSegments();
}

function isPointInsideSegment(x, y, segment) {
    return x >= segment.x && x <= segment.x + segment.width && y >= segment.y && y <= segment.y + segment.height;
}

function getDivisionX(mouseX, segment) {
    const proportion = (mouseX - segment.x) / segment.width;
    const segmentDivisionValue = getSegmentDivisionValue(segment, true);

    if (proportion < 0.5) {
        return segment.x + segmentDivisionValue;
    } else {
        return segment.x + segment.width - segmentDivisionValue;
    }
}

function getDivisionY(mouseY, segment) {
    const proportion = (mouseY - segment.y) / segment.height;
    const segmentDivisionValue = getSegmentDivisionValue(segment, false);

    if (proportion < 0.5) {
        return segment.y + segmentDivisionValue;
    } else {
        return segment.y + segment.height - segmentDivisionValue;
    }
}

function checkForSegmentDivision(mouseX, mouseY) {
    ghost = [];
    highlightedSegment = null;

    for (let segment of segments) {
        if (isPointInsideSegment(mouseX, mouseY, segment)) {
            highlightedSegment = segment;
            
            const divisionType = document.getElementById('divisionType').value;
            if (divisionType === "goldenRatio") {
                const divisionX = getDivisionX(mouseX, segment);
                const divisionY = getDivisionY(mouseY, segment);

                const topDistance = mouseY - segment.y;
                const bottomDistance = segment.y + segment.height - mouseY;
                const leftDistance = mouseX - segment.x;
                const rightDistance = segment.x + segment.width - mouseX;

                const minDistance = Math.min(topDistance, bottomDistance, leftDistance, rightDistance);

                if (minDistance === leftDistance || minDistance === rightDistance) {
                    ghost.push({
                        x: divisionX,
                        y: segment.y,
                        width: 1,
                        height: segment.height,
                        isVertical: true
                    });
                } else {
                    ghost.push({
                        x: segment.x,
                        y: divisionY,
                        width: segment.width,
                        height: 1,
                        isVertical: false
                    });
                }
            } else {
                const divisions = parseInt(divisionType);
                if (Math.abs(mouseX - segment.x) < segment.width / 2) {  // Check if the click is on the left or right half
                    for (let i = 1; i < divisions; i++) {
                        ghost.push({
                            x: segment.x + (segment.width / divisions) * i,
                            y: segment.y,
                            width: 1,
                            height: segment.height,
                            isVertical: true
                        });
                    }
                } else {
                    for (let i = 1; i < divisions; i++) {
                        ghost.push({
                            x: segment.x,
                            y: segment.y + (segment.height / divisions) * i,
                            width: segment.width,
                            height: 1,
                            isVertical: false
                        });
                    }
                }
            }
            break;
        }
    }
    drawSegments();
}

canvas.addEventListener('mousemove', function(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    checkForSegmentDivision(mouseX, mouseY);
});

canvas.addEventListener('click', function(e) {
    if (ghost.length) {
        const segment = highlightedSegment;

        // Remove the original segment
        const index = segments.indexOf(segment);
        if (index > -1) {
            segments.splice(index, 1);
        }

        if (document.getElementById('divisionType').value === "goldenRatio") {
            if (ghost[0].isVertical) {
                segments.push({
                    x: segment.x,
                    y: segment.y,
                    width: ghost[0].x - segment.x,
                    height: segment.height
                });
                segments.push({
                    x: ghost[0].x,
                    y: segment.y,
                    width: (segment.x + segment.width) - ghost[0].x,
                    height: segment.height
                });
            } else {
                segments.push({
                    x: segment.x,
                    y: segment.y,
                    width: segment.width,
                    height: ghost[0].y - segment.y
                });
                segments.push({
                    x: segment.x,
                    y: ghost[0].y,
                    width: segment.width,
                    height: (segment.y + segment.height) - ghost[0].y
                });
            }
        } else {
            let lastPosition = ghost[0].isVertical ? segment.x : segment.y;

            ghost.forEach(ghostSegment => {
                if (ghostSegment.isVertical) {
                    segments.push({
                        x: lastPosition,
                        y: segment.y,
                        width: ghostSegment.x - lastPosition,
                        height: segment.height
                    });
                    lastPosition = ghostSegment.x;
                } else {
                    segments.push({
                        x: segment.x,
                        y: lastPosition,
                        width: segment.width,
                        height: ghostSegment.y - lastPosition
                    });
                    lastPosition = ghostSegment.y;
                }
            });

            // Add the last segment after the last ghost division
            if (ghost[0].isVertical) {
                segments.push({
                    x: lastPosition,
                    y: segment.y,
                    width: (segment.x + segment.width) - lastPosition,
                    height: segment.height
                });
            } else {
                segments.push({
                    x: segment.x,
                    y: lastPosition,
                    width: segment.width,
                    height: (segment.y + segment.height) - lastPosition
                });
            }
        }

        drawSegments();
        saveState();
    }
});

function resetCanvas() {
    document.getElementById('widthInput').value = 800;
    document.getElementById('heightInput').value = 450;
    updateCanvasDimensions(true);
}

function drawSegments() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "7px Lato";
    ctx.textBaseline = 'middle';

    segments.forEach(segment => {
        if (highlightedSegment === segment) {
            ctx.fillStyle = 'white';
            ctx.fillRect(segment.x, segment.y, segment.width, segment.height);
        }

        ctx.strokeStyle = '#499ed2';
        ctx.strokeRect(segment.x, segment.y, segment.width, segment.height);
        
        ctx.fillStyle = '#499ed2';
        ctx.fillText(Math.round(segment.width).toString(), segment.x + segment.width / 2, segment.y);
        ctx.fillText(Math.round(segment.width).toString(), segment.x + segment.width / 2, segment.y + segment.height);
        ctx.fillText(Math.round(segment.height).toString(), segment.x, segment.y + segment.height / 2);
        ctx.fillText(Math.round(segment.height).toString(), segment.x + segment.width, segment.y + segment.height / 2);
    });

    ghost.forEach(ghostSegment => {
        ctx.strokeStyle = '#3d8a4c';
        if (ghostSegment.isVertical) {
            ctx.beginPath();
            ctx.moveTo(ghostSegment.x, ghostSegment.y);
            ctx.lineTo(ghostSegment.x, ghostSegment.y + ghostSegment.height);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(ghostSegment.x, ghostSegment.y);
            ctx.lineTo(ghostSegment.x + ghostSegment.width, ghostSegment.y);
            ctx.stroke();
        }
    });
}

updateCanvasDimensions();
resetCanvas();
saveState();

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width, canvas.height]
    });

    // Iterate over each segment and draw it on the PDF
    doc.rect(0, 0, canvas.width, canvas.height);
    segments.forEach(segment => {
        doc.rect(segment.x, segment.y, segment.width, segment.height);
    });

    // Save the generated PDF
    doc.save("exported_canvas.pdf");
}

function exportWithDimensionsToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width, canvas.height]
    });

    // Iterate over each segment and draw it on the PDF, including dimensions
    doc.rect(0, 0, canvas.width, canvas.height);
    segments.forEach(segment => {
        doc.rect(segment.x, segment.y, segment.width, segment.height);
        doc.text(`${Math.round(segment.width)}`, segment.x + segment.width / 2, segment.y - 10);
        doc.text(`${Math.round(segment.height)}`, segment.x - 20, segment.y + segment.height / 2);
    });

    // Save the generated PDF
    doc.save("exported_with_dimensions_canvas.pdf");
}

