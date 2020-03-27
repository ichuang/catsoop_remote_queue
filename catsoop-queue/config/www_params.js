const params = {
    // Set this to true to enable the staff list
    SHOW_STAFF_LIST: false,

    // This function will be used to get the url for a student's photo. Set this to null to disable
    // the photo display entirely.
    get_photo_url: username => {
        const photo_root = [catsoop.url_root, catsoop.course, 'student_picture'].join('/');
        return `${photo_root}?username=${username}`;
    },

    // This function will be used to get the url for audio files. Set this to null to disable
    // audio entirely.
    get_audio_url: filename => {
        const audio_root = [catsoop.plugins.queue.url_root, 'audio'].join('/');
        return `${audio_root}/${filename}`;
    },

};

module.exports = params;
