"use strict";

const canvas = $('#cnv');
const ctx = canvas.getContext('2d');

let width  = canvas.width  = window.innerWidth;
let height = canvas.height = window.innerHeight;

// Make sure dimensions are evenly divisible
if (width%2)  width++;
if (height%2) height++;

let small = (width<height)?width:height;

function $(css_selector) {
  return document.querySelector(css_selector);
}

function $$(css_selector) {
  return document.querySelectorAll(css_selector);
}

const help_overlay = $('#help');
const info_overlay = $('#info');
const palette_overlay = $('#palette');
const inverter = $('#inverter');

const version = '1.3';

if (localStorage.getItem('version') == version) {
    // hide help on load if already seen
    help_overlay.style.display = 'none';
} else {
    // otherwise remember we've seen this version for next time
    localStorage.setItem('version', version);
}

var pos_r = 0,
    pos_i = 0,
    zoom = 1,
    itr = 1000,
    aa = 1,
    speed = 1,
    acc = 1;

var palette = [...$$('[type="color"]')].map(x => hex_to_rgb(x.value));

// to stop render
var id = false;

Array.prototype.equals = function(that) {
  if (this.length != that.length) return false;

  for (let i = 0; i < this.length; i++) {
    if (this[i] !== that[i]) return false;
  }

  return true;
}

function add_rgb(c1, c2) {
  return [c1[0]+c2[0], c1[1]+c2[1], c1[2]+c2[2]];
}

function div_rgb(c, n) {
  return [c[0]/n, c[1]/n, c[2]/n];
}

function hsv_to_rgb(H, S, V) {
  let C = V * S;
  let Hp = ((360+H) % 360) / 60;
  let X = C * (1 - Math.abs(Hp % 2 - 1));

  let R, G, B;
  if (0 <= Hp && Hp <= 1) [R, G, B] = [C, X, 0];
  else if (Hp <= 2)       [R, G, B] = [X, C, 0];
  else if (Hp <= 3)       [R, G, B] = [0, C, X];
  else if (Hp <= 4)       [R, G, B] = [0, X, C];
  else if (Hp <= 5)       [R, G, B] = [X, 0, C];
  else if (Hp <= 6)       [R, G, B] = [C, 0, X];
  else R = G = B = 0;

  let m = V - C;
  return [(R+m)*255, (G+m)*255, (B+m)*255];
}

function hex_to_rgb(hex) {
  let [r, g, b] = [0, 0, 0];

  if (hex.length == 4 || hex.length == 7) hex = hex.slice(1);

  if (hex.length == 3) {
    r = '0x' + hex[0] + hex[0];
    g = '0x' + hex[1] + hex[1];
    b = '0x' + hex[2] + hex[2];
  } else if (hex.length == 6) {
    r = '0x' + hex.slice(0, 2);
    g = '0x' + hex.slice(2, 4);
    b = '0x' + hex.slice(4, 6);
  }

  return [+r, +g, +b];
}


function cos_interp(p1, p2, nrm) {
  nrm = (1-Math.cos(nrm*Math.PI))/2;
  return p1*(1-nrm)+p2*nrm;
}

// smoothly interpolate between hand-picked colours
function cycle(percent) {
  percent %= palette.length * 100;

  let last = percent / 100 | 0;
  let next = (last + 1) % palette.length;

  percent = percent % 100 / 100;
  
  return [
    cos_interp(palette[last][0]**2.2, palette[next][0]**2.2, percent)**(1/2.2),
    cos_interp(palette[last][1]**2.2, palette[next][1]**2.2, percent)**(1/2.2),
    cos_interp(palette[last][2]**2.2, palette[next][2]**2.2, percent)**(1/2.2)
  ];
}

// Calculate number of steps in function at given location
let smooth = true;
function calc_point(c_r, c_i) {
  let count = 1;
  let z_r = 0;
  let z_i = 0;
  for (var i = 0; i < itr; i++, count++) {
    // translates to z = z**2 + c
    [z_r, z_i] = [z_r*z_r - z_i*z_i + c_r, 2*z_r*z_i + c_i];
    if (z_r*z_r+z_i*z_i >= 400) return !smooth ? count : count + 1 - Math.log(Math.log(Math.hypot(z_r, z_i)))/Math.log(2);
  }
  return false;
}

function render() {
  let local_id = ++id;
  ctx.setTransform(1,0,0,-1,width/2,height/2);
  inverter.style.display = 'block';

  let colour, point, real, imag;
  (function row(y) {
    if (local_id == id) {
      for (var x = -width/2; x < width/2; x++) {
        colour = [0, 0, 0];

        for (var xaa = 0; xaa < aa; xaa++) {
          for (var yaa = 0; yaa < aa; yaa++) {
            // samples
            real = x + xaa / aa + (1/aa/2);
            imag = y + yaa / aa + (1/aa/2);

            // zoom
            real = real / (small/4) / zoom;
            imag = imag / (small/4) / zoom;

            // set coordinates
            real += pos_r;
            imag += pos_i;

            point = calc_point(real, -imag);

            if (point) {
              colour = add_rgb(colour, cycle((point*speed)**acc));
            } else {
              colour = add_rgb(colour, [0, 0, 0]);
            }
          }
        }

        colour = div_rgb(colour, aa*aa);
        ctx.fillStyle = `rgb(${colour[0]|0}, ${colour[1]|0}, ${colour[2]|0})`;
        ctx.fillRect(x, y, 1, 1);
      }

      inverter.style.top = height/2 - y - 1 + 'px';
      /*
      ctx.strokeStyle = '#f00';
      ctx.beginPath();
      ctx.moveTo(-width/2, y-.5);
      ctx.lineTo( width/2, y-.5);
      ctx.stroke();
      */

      $('#complete').innerText = `${ ((-y + height/2) / height * 100).toFixed(2) }%`;
      if (y > -height/2) {
        setTimeout(()=>row(y-1), 0);
      } else {
        inverter.style.display = 'none';
      }
    }
  })(height/2);
}

function update_info() {
  $('#real').innerText = pos_r;
  $('#imaginary').innerText = pos_i;
  $('#zoom').innerText = zoom;

  $('#itr').innerText = itr;
  $('#aa').innerText = aa;
  $('#speed').innerText = speed;
  $('#acc').innerText = acc;
}

function update_palette() {
  palette = [...$$('[type="color"]')].map(x => hex_to_rgb(x.value));
  render();
}

function remove_colour(e) {
  let parent = e.target.parentElement;
  if (parent.parentElement.childElementCount > 1) {
    parent.remove();
    update_palette();
  }
}

function add_colour() {
  $('#colours').appendChild(document.createElement('li')).innerHTML = 
    "<input type='color' value='#000000' onchange='update_palette()'> <input type='image' src='minus.svg' class='remove' onclick='remove_colour(event)'>";

  update_palette();
}

function settings() {
  let previous = [itr, aa, speed, acc];

  itr     = +prompt('Set number of iterations') || itr;
  aa = +prompt('Set anti-aliasing level') || aa;
  speed   = +prompt('Set colour speed') || speed;
  acc     = +prompt('Set colour acceleration') || acc;

  update_info();
  if (![itr, aa, speed, acc].equals(previous)) render();
}

function set_pos() {
  let previous = [pos_r, pos_i, zoom];

  let prompt_pos_r = prompt('Set real coordinate');
  let prompt_pos_i = prompt('Set imaginary coordinate');

  if (prompt_pos_r || prompt_pos_r === '0') pos_r = +prompt_pos_r;
  if (prompt_pos_i || prompt_pos_i === '0') pos_i = +prompt_pos_i;

  zoom = +prompt('Set zoom') || zoom;

  update_info();
  if (![pos_r, pos_i, zoom].equals(previous)) render();
}

function reset() {
  if (confirm('Reset settings to their defaults?')) {
    pos_r = 0;
    pos_i = 0;
    zoom = 1;
    itr = 1000;
    aa = 1;
    speed = 1;
    acc = 1;

    update_info();
    render();
  }
}

function hide_overlays() {
  let overlays = $$('.overlay');
  overlays.forEach(o => o.style.display = 'none');
}

function set_dimensions(x = 0, y = 0) {
  while (!(x > 0)) {
    x = +prompt('X resolution');
  }

  while (!(y > 0)) {
    y = +prompt('Y resolution');
  }

  width  = canvas.width  = +x;
  height = canvas.height = +y;
  if (width  % 2) width++;
  if (height % 2) height++;
  small = (width < height) ? width : height;

  render();
}

window.addEventListener('keydown', e => {
  switch(e.key) {
    case 'q':
    case 'Q':
      settings();
      break;
    case 'w':
    case 'W':
      set_pos();
      break;
    case 'r': 
    case 'R':
      reset();
      break;
    case 'i':
    case 'I':
      if (info_overlay.style.display === 'none' || !info_overlay.style.display) {
        hide_overlays();
        info_overlay.style.display = 'block';
      } else {
        info_overlay.style.display = 'none';
      }
      break;
    case 'p':
    case 'P':
      if (palette_overlay.style.display === 'none' || !palette_overlay.style.display) {
        hide_overlays();
        palette_overlay.style.display = 'block';
      } else {
        palette_overlay.style.display = 'none';
      }
      break;
    case 'd':
    case 'D':
      set_dimensions();
      break;
    case '+':
      zoom *= 2;
      update_info();
      render();
      break;
    case '-':
      zoom /= 1.5;
      update_info();
      render();
      break;
    case 'F1':
      e.preventDefault();
    case '?':
      if (help_overlay.style.display === 'none') {
        hide_overlays();
        help_overlay.style.display = 'block';
      } else {
        help_overlay.style.display = 'none';
      }
      break;
    case 'Escape':
      hide_overlays();
      break;
    case 'ArrowRight':
      pos_r += 10/width/zoom;
      update_info();
      render();
      break;
    case 'ArrowLeft':
      pos_r -= 10/width/zoom;
      update_info();
      render();
      break;
    case 'ArrowUp':
      pos_i += 10/height/zoom;
      update_info();
      render();
      break;
    case 'ArrowDown':
      pos_i -= 10/height/zoom;
      update_info();
      render();
      break;
    default:
      console.log(e.key);
      break;
  }
});

var resize_popup = false;
window.addEventListener('resize', e => {
  if (!resize_popup) {
    resize_popup = true;
    let answer = confirm('Window was resized; restart render at new window size?');
    resize_popup = false;

    if (answer) {
      width  = canvas.width  = window.innerWidth;
      height = canvas.height = window.innerHeight;

      if (width%2)  width++;
      if (height%2) height++;

      small = (width<height)?width:height;

      render();
    }
  }
});

canvas.addEventListener('click', e => {
  pos_r += (e.offsetX -  width/2)/small*4/zoom;
  pos_i -= (e.offsetY - height/2)/small*4/zoom;

  if (e.shiftKey) {
    zoom /= 1.5;
  } else if (!e.ctrlKey) {
    zoom *= 2;
  }

  update_info();
  render();
});

render();
