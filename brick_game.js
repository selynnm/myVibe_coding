const canvas = document.querySelector("#board");
const context = canvas.getContext("2d");
const scoreLabel = document.querySelector("#score");
const remainingLabel = document.querySelector("#remaining");
const attemptsLabel = document.querySelector("#attempts");
const statusLabel = document.querySelector("#status");
const instruction = document.querySelector("#instruction");
const result = document.querySelector("#result");
const resultTitle = document.querySelector("#result-title");
const finalScore = document.querySelector("#final-score");

const rows = 7;
const reserveRows = 7;
const topY = 65;
const columns = 10;
const brickWidth = 100;
const brickHeight = 30;
const gap = 5;
const rowHeight = brickHeight + gap;
const totalBricks = (rows + reserveRows) * columns;
const baseSpeed = 300;
const aladdin = { x: 0, y: canvas.height - 105, facing: 1, scale: 1.5 };
const handOffset = 43;
const ball = { x: 0, y: 0, radius: 24, vx: 0, vy: 0 };
const keys = new Set();
const sky = context.createLinearGradient(0, 0, 0, canvas.height);
sky.addColorStop(0, "#090b29");
sky.addColorStop(0.65, "#1c1745");
sky.addColorStop(1, "#503050");
const stars = Array.from({ length: 64 }, (_, index) => ({
  x: (index * 157 + 43) % canvas.width,
  y: 65 + ((index * 83 + 17) % 480),
  size: index % 7 === 0 ? 2 : 1,
}));

let bricks;
let broken;
let rowsInReserve;
let attempts = 3;
let state = "대기";
let previousTime;
let celebrationTime = 0;

function updateLabels() {
  const score = broken * 10;
  scoreLabel.textContent = `점수 ${score}점`;
  remainingLabel.textContent = `남은 벽돌 ${totalBricks - broken}개`;
  attemptsLabel.textContent = `남은 기회 ${attempts}회`;
  statusLabel.textContent = state;
  const messages = {
    "대기": "스페이스키를 눌러 공을 던지세요.",
    "진행 중": "왼쪽·오른쪽 방향키로 알라딘을 움직여 공을 받으세요.",
    "기회 종료": "스페이스키를 눌러 다음 게임을 시작하세요.",
    "성공": "스페이스키로 다시 시작하세요.",
    "게임 종료": "스페이스키로 다시 시작하세요.",
  };
  instruction.textContent = messages[state];
  result.hidden = state !== "성공" && state !== "게임 종료";
  if (!result.hidden) {
    resultTitle.textContent = state === "게임 종료" ? "분발하세요!" : state;
    finalScore.textContent = `최종 점수 ${score}점`;
  }
}

function addRow(slot, startY) {
  for (let column = 0; column < columns; column += 1) {
    bricks.push({
      slot,
      x: 10 + column * (brickWidth + gap),
      y: startY,
      width: brickWidth,
      height: brickHeight,
    });
  }
}

function resetRound() {
  bricks = [];
  rowsInReserve = reserveRows;
  for (let slot = 0; slot < rows; slot += 1) {
    addRow(slot, topY + slot * rowHeight);
  }
  broken = 0;
  aladdin.x = canvas.width / 2;
  aladdin.facing = 1;
  parkBall();
  ball.vx = 0;
  ball.vy = 0;
}

function parkBall() {
  ball.x = aladdin.x + handOffset * aladdin.facing;
  ball.y = aladdin.y - 27;
}

function startRound() {
  if (state === "성공" || state === "게임 종료") {
    attempts = 3;
  }
  if (state !== "대기") {
    resetRound();
  }
  state = "진행 중";
  celebrationTime = 0;
  throwBall();
  updateLabels();
}

function throwBall() {
  parkBall();
  const diagonalSpeed = (baseSpeed + Math.floor(broken / 10) * 15) / Math.SQRT2;
  ball.vx = diagonalSpeed * aladdin.facing;
  ball.vy = -diagonalSpeed;
}

function touches(rectangle) {
  const nearestX = Math.max(rectangle.x, Math.min(ball.x, rectangle.x + rectangle.width));
  const nearestY = Math.max(rectangle.y, Math.min(ball.y, rectangle.y + rectangle.height));
  return Math.hypot(ball.x - nearestX, ball.y - nearestY) <= ball.radius;
}

function step(seconds) {
  const holdingBall = state === "대기";
  if (!holdingBall && state !== "진행 중") return;

  const direction = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
  if (direction !== 0) aladdin.facing = direction;
  const margin = handOffset + ball.radius;
  aladdin.x = Math.max(margin, Math.min(canvas.width - margin, aladdin.x + direction * 540 * seconds));
  if (holdingBall) {
    parkBall();
    return;
  }

  for (const brick of bricks) {
    brick.y = Math.min(topY + brick.slot * rowHeight, brick.y + 175 * seconds);
  }

  const oldX = ball.x;
  const oldY = ball.y;
  ball.x += ball.vx * seconds;
  ball.y += ball.vy * seconds;

  if (ball.x <= ball.radius || ball.x >= canvas.width - ball.radius) {
    ball.x = Math.max(ball.radius, Math.min(canvas.width - ball.radius, ball.x));
    ball.vx = ball.x === ball.radius ? Math.abs(ball.vx) : -Math.abs(ball.vx);
  }
  if (ball.y <= ball.radius) {
    ball.y = ball.radius;
    ball.vy = Math.abs(ball.vy);
  }

  const catchArea = { x: aladdin.x - 45, y: aladdin.y - 19, width: 90, height: 33 };
  if (ball.vy > 0 && oldY <= catchArea.y && touches(catchArea)) {
    // 닿은 위치에서 바로 튕기며, 중앙에서 멀리 맞을수록 각도가 커집니다.
    const offset = Math.max(-1, Math.min(1, (ball.x - aladdin.x) / (catchArea.width / 2)));
    const angle = offset * Math.PI / 3;
    const speed = Math.hypot(ball.vx, ball.vy);
    ball.y = catchArea.y - ball.radius;
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.cos(angle) * speed;
    return;
  }

  const hitIndex = bricks.findIndex(touches);
  if (hitIndex !== -1) {
    const brick = bricks[hitIndex];
    bricks.splice(hitIndex, 1);
    broken += 1;

    // 들어오기 직전 공의 위치로 벽돌의 옆면과 윗면·아랫면을 구분합니다.
    if (oldY + ball.radius <= brick.y || oldY - ball.radius >= brick.y + brick.height) {
      ball.vy *= -1;
    } else if (oldX + ball.radius <= brick.x || oldX - ball.radius >= brick.x + brick.width) {
      ball.vx *= -1;
    } else {
      const nearestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
      const nearestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
      if (Math.abs(ball.x - nearestX) > Math.abs(ball.y - nearestY)) {
        ball.vx *= -1;
      } else {
        ball.vy *= -1;
      }
    }

    if (broken === totalBricks) {
      state = "성공";
    } else if (broken % 10 === 0) {
      const speed = baseSpeed + (broken / 10) * 15;
      const ratio = speed / Math.hypot(ball.vx, ball.vy);
      ball.vx *= ratio;
      ball.vy *= ratio;
    }
    // 비워진 층 위의 벽돌을 한 칸 내리고 맨 위에 새 층을 넣습니다.
    if (rowsInReserve > 0 && !bricks.some((remaining) => remaining.slot === brick.slot)) {
      for (const remaining of bricks) {
        if (remaining.slot < brick.slot) remaining.slot += 1;
      }
      addRow(0, Math.min(topY, ...bricks.filter((remaining) => remaining.slot === 1)
        .map((remaining) => remaining.y)) - rowHeight);
      rowsInReserve -= 1;
    }
    updateLabels();
  }

  if (ball.y - ball.radius >= canvas.height) {
    attempts -= 1;
    state = attempts > 0 ? "기회 종료" : "게임 종료";
    updateLabels();
  }
}

function drawScenery() {
  context.fillStyle = sky;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#d7c5a1";
  for (const star of stars) {
    context.fillRect(star.x, star.y, star.size, star.size);
  }

  // 두 원이 겹치는 자리를 비워 초승달을 그립니다.
  context.save();
  context.beginPath();
  context.arc(906, 408, 42, 0, 2 * Math.PI);
  context.clip();
  context.fillStyle = "#f4d38b";
  context.beginPath();
  context.arc(906, 408, 42, 0, 2 * Math.PI);
  context.moveTo(960, 387);
  context.arc(922, 387, 38, 0, 2 * Math.PI);
  context.fill("evenodd");
  context.restore();

  // 낮은 채도의 궁전 실루엣으로 공과 양탄자를 돋보이게 합니다.
  context.fillStyle = "#15112e";
  for (const [x, y, width] of [[75, 583, 105], [225, 552, 145], [392, 523, 224], [655, 565, 132], [838, 590, 98]]) {
    context.fillRect(x, y, width, canvas.height - y);
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(x, y - 34, x + width / 2, y - 40, x + width / 2, y - 65);
    context.bezierCurveTo(x + width / 2, y - 40, x + width, y - 34, x + width, y);
    context.fill();
  }
}

function drawAladdin(jumpHeight, armHeight) {
  context.save();
  context.translate(aladdin.x, aladdin.y - jumpHeight);
  context.scale(aladdin.facing * aladdin.scale, aladdin.scale);

  // 달빛 아래 보이는 조끼, 허리띠, 헐렁한 바지와 신발을 그립니다.
  context.fillStyle = "#fff0d9";
  context.beginPath();
  context.ellipse(-9, 29, 11, 20, 0.2, 0, 2 * Math.PI);
  context.ellipse(9, 29, 11, 20, -0.2, 0, 2 * Math.PI);
  context.fill();

  context.fillStyle = "#d6993d";
  context.fillRect(-20, 44, 17, 6);
  context.fillRect(5, 44, 18, 6);
  context.fillStyle = "#ad3a79";
  context.beginPath();
  context.roundRect(-16, -3, 32, 29, 8);
  context.fill();
  context.fillStyle = "#ffd783";
  context.fillRect(-15, 18, 30, 5);

  context.strokeStyle = "#e6a675";
  context.lineWidth = 8;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(-13, 2);
  context.lineTo(-27, armHeight);
  context.moveTo(13, 2);
  context.lineTo(27, armHeight);
  context.stroke();

  context.fillStyle = "#e6a675";
  context.beginPath();
  context.arc(0, -15, 13, 0, 2 * Math.PI);
  context.fill();
  context.fillStyle = "#2c1730";
  context.fillRect(5, -17, 3, 3);
  context.fillStyle = "#a52d64";
  context.beginPath();
  context.roundRect(-12, -34, 23, 12, [5, 5, 2, 2]);
  context.fill();
  context.restore();
}


function drawFireworks(time) {
  const colors = ["#ffdc82", "#ff85bd", "#89d8ff", "#c7a5ff"];
  for (let burst = 0; burst < 4; burst += 1) {
    const age = (time + burst * 0.38) % 1.6;
    if (age > 1.15) continue;

    context.globalAlpha = 1 - age / 1.15;
    context.fillStyle = colors[burst];
    const centerX = [190, 865, 300, 765][burst];
    const centerY = [390, 350, 485, 470][burst];
    for (let spark = 0; spark < 16; spark += 1) {
      const angle = spark * Math.PI / 8 + burst * 0.2;
      const distance = age * (62 + (spark % 4) * 17);
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance + 34 * age ** 2;
      context.fillRect(x, y, 3, 3);
    }
  }
  context.globalAlpha = 1;
}

function draw() {
  drawScenery();
  context.save();
  context.beginPath();
  context.rect(0, topY, canvas.width, canvas.height - topY);
  context.clip();
  for (const brick of bricks) {
    const shading = context.createLinearGradient(0, brick.y, 0, brick.y + brick.height);
    shading.addColorStop(0, "#8ad0ff");
    shading.addColorStop(0.23, "#388fff");
    shading.addColorStop(0.72, "#185ad0");
    shading.addColorStop(1, "#103274");
    context.fillStyle = shading;
    context.strokeStyle = "#579aff";
    context.beginPath();
    context.roundRect(brick.x + 0.5, brick.y + 0.5, brick.width - 1, brick.height - 1, 7);
    context.fill();
    context.stroke();
  }
  context.restore();
  const finished = state === "성공" || state === "게임 종료";
  const jump = finished ? Math.abs(Math.sin(celebrationTime * Math.PI * 2.1)) : 0;
  if (finished) drawFireworks(celebrationTime);
  drawAladdin(jump * 42, finished ? -21 - jump * 17 : -6);
  context.fillStyle = "#fff5df";
  context.font = 'bold 16px "맑은 고딕", sans-serif';
  context.textAlign = "center";
  context.fillText("알라딘", aladdin.x, aladdin.y + 95 - jump * 42);

  const glow = context.createRadialGradient(ball.x - 8, ball.y - 9, 2, ball.x, ball.y, ball.radius);
  glow.addColorStop(0, "#fff8d2");
  glow.addColorStop(0.52, "#ffd568");
  glow.addColorStop(1, "#e58a24");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(ball.x, ball.y, ball.radius, 0, 2 * Math.PI);
  context.fill();
}

function animate(time) {
  const elapsed = Math.min((time - (previousTime ?? time)) / 1000, 0.05);
  previousTime = time;
  // 한 번에 짧게 이동시켜 빠른 공도 벽돌이나 바를 통과하지 않게 합니다.
  const steps = Math.max(1, Math.ceil(elapsed * 240));
  for (let index = 0; index < steps; index += 1) {
    step(elapsed / steps);
  }
  if (state === "성공" || state === "게임 종료") {
    celebrationTime += elapsed;
  }
  draw();
  requestAnimationFrame(animate);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
    event.preventDefault();
    keys.add(event.code);
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (!event.repeat && state !== "진행 중") startRound();
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", () => keys.clear());

resetRound();
updateLabels();
requestAnimationFrame(animate);
