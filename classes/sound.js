
var soundDic = {};

defineSound("digging.wav", 0.7);
defineSound("swing.wav", 0.5);
defineSound("eat.ogg", 0.5);
defineSound("hit.ogg", 0.5);
defineSound("placing_dirt.wav", 0.4);
defineSound("placing_structure.ogg", 0.5);
defineSound("snd_bizarreexplode.ogg", 0.5);

class SoundObj{
    constructor(sound, x, y){
        this.pos = createVector(x, y);
        this.sound = sound;
        this.lifetime = soundDic[this.sound].sounds[1].duration() * 60; // in frames
        this.id = random(1000000);
        this.deleteTag = false;
        this.play();
    }

    update(){
        this.lifetime -= 1;
        if(this.lifetime <= 0){
            this.deleteTag = true;
            let chunkPos = testMap.globalToChunk(this.pos.x, this.pos.y);
            socket.emit("delete_sound", {cPos: chunkPos, pos:{x: this.pos.x, y: this.pos.y}, id: this.id});
        }
    }

    play(){
        if(curPlayer != undefined){
            let localVolume = 1 - (curPlayer.pos.dist(this.pos)/(2*CHUNKSIZE*TILESIZE));
            localVolume = constrain(localVolume, 0, 1);
            localVolume = round(localVolume * 20) / 20; // Round to nearest 10%
            if(localVolume <= 0) return;
            soundDic[this.sound].sounds[localVolume*20].rate(random(0.8, 1.2));
            soundDic[this.sound].sounds[localVolume*20].play();
        }
    }

    stop(){
        for(let i = 0; i < soundDic[this.sound].length; i++){
            soundDic[this.sound][i].stop();
        }
    }
}

function defineSound(sound, volume){
    let soundArray = [];
    for(let i = 0; i < 21; i++){
        soundArray.push(`audio/${sound}`);
    }
    soundDic[sound] = {
        sounds: soundArray,
        volume: volume
    };
}