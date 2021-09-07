// import logo from './logo.svg';
import './Css/App.css';
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

function useInterval(callback, delay) {
  // https://overreacted.io/making-setinterval-declarative-with-react-hooks/
  const savedCallback = useRef();

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      let id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

function shuffleArray(array) {
  //https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
  }
}

const getFormattedDuration = (total) => {
  // Converts seconds to HH:MM:SS or MM:SS
  let hours = String(Math.floor(total / 3600));
  let minutes = String(Math.floor((total - (Number(hours) * 3600)) / 60));
  let seconds = String(total - (Number(hours) * 3600) - (Number(minutes) * 60));
  return hours > 0 ? `${hours}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}` : `${minutes}:${seconds.padStart(2, '0')}`
}

function PlayerForm(props) {
  const [value, setValue] = useState('');

  const handleSubmit = (event) => {
    props.onVideoChange(value);
    setValue('');
    event.preventDefault();
  }

  return (
    <form id="player-form" onSubmit={event => handleSubmit(event)}>
      <label>
        <input 
          type="text" 
          value={value} 
          onChange={event => setValue(event.target.value)} 
          placeholder="Enter Youtube Video" />
      </label>
    </form>
  )
}

function Video(props) {
  const [videoPlayer, setVideoPlayer] = useState(null);

  useEffect(() => {
    // Enables Youtube iFrame API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      window.onYouTubeIframeAPIReady = loadPlayer;
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      loadPlayer();
    }
  }, []);

  useEffect(() => {
    if (videoPlayer) {
      loadPlaylist();
      props.setPlaying(true);
    }
  }, [props.videoId]);

  useEffect(() => {
    if (videoPlayer) props.isPlaying ? videoPlayer.playVideo() : videoPlayer.pauseVideo();
  }, [props.isPlaying]);

  useEffect(() => {
    if (videoPlayer) {
      videoPlayer.loadVideoById({
        'videoId': props.videoId,
        'startSeconds': getTimestamp().start,
        'endSeconds': getTimestamp().end
      });
    }
  }, [props.currentTimestampIndx]);

  useEffect(() => {
    if (videoPlayer) videoPlayer.seekTo(props.newTime);
  }, [props.newTime]);

  const loadPlayer = () => {
    axios.get(`https://mysterious-lake-28010.herokuapp.com/api/v1/video?link=https://www.youtube.com/watch?v=${props.videoId}`)
      .then(response => {
        props.setTimestampData(response.data);
        let timestamp = response.data.timestamps[0];
        new window.YT.Player('video', {
          videoId: props.videoId,
          playerVars: {
            start: timestamp.start,
            end: timestamp.end,
            enablejsapi: 1,
            controls: 0
          },
          events: {
            onReady: (event) => setVideoPlayer(event.target),
          }
        });
      });
  };

  const loadPlaylist = () => {
    axios.get(`https://mysterious-lake-28010.herokuapp.com/api/v1/video?link=https://www.youtube.com/watch?v=${props.videoId}`)
      .then(response => {
        props.setCurrentTimestampIndx(0);
        props.setTimestampData(response.data);
        let timestamp = response.data.timestamps[0];
        videoPlayer.loadVideoById({
          'videoId': props.videoId,
          'startSeconds': timestamp.start,
          'endSeconds': timestamp.end
        });
      });
  };

  const getTimestamp = (indx = props.currentTimestampIndx) => {
    return props.timestampData.timestamps[indx];
  }

  const updateTimer = () => {
    if (!videoPlayer) return;
    if (videoPlayer.getPlayerState() === window.YT.PlayerState.ENDED) {
      if (props.isRepeat) {
        videoPlayer.loadVideoById({
          'videoId': props.videoId,
          'startSeconds': getTimestamp().start,
          'endSeconds': getTimestamp().end
        });
      } else {
        props.handleTimestampSelection(props.currentTimestampIndx + 1, 'ended');
      }
    };
    props.setCurrentTime(Math.floor(videoPlayer.getCurrentTime()) - getTimestamp().start);
  }
  useInterval(updateTimer, 100);

  return (
    <div id="videoContainer">
      <div id="video"></div>
    </div>
  )
};

function Player(props) { 
  const [timestampData, setTimestampData] = useState({
    videoId: '',
    title: '',
    duration: 0,
    timestamps: [
      {
        title: '',
        start: 0,
        end: 0
      },
    ]
  });
  const [currentTimestampIndx, setCurrentTimestampIndx] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [newTime, setNewTime] = useState(0);
  const [isPlaying, setPlaying] = useState(false);
  const [isShuffle, setShuffle] = useState(false);
  const [isRepeat, setRepeat] = useState(false);
  const [shuffledIndexes, setShuffledIndexes] = useState([]);

  const getTimestamp = (indx = currentTimestampIndx) => {
    return timestampData.timestamps[indx];
  }

  const toggleShuffle = () => {
    if (!isShuffle) {
      let shuffledIndexes = [...Array(timestampData.timestamps.length).keys()];
      shuffleArray(shuffledIndexes);
      setShuffledIndexes(shuffledIndexes);
    }
    setShuffle(!isShuffle);
  };

  const handleTimestampSelection = (indx, reason = null) => {
    if (indx === -1) {
      indx = timestampData.timestamps.length - 1;
    } else if (indx === timestampData.timestamps.length) {
      indx = 0;
    }

    // Reasons: ended, chosen
    if (reason == 'ended' && isRepeat) {
      indx = currentTimestampIndx;
    } else if (reason != 'chosen' && isShuffle) {
      indx = shuffledIndexes[indx];
    }

    setCurrentTimestampIndx(indx);
    setPlaying(true);
  };

  const handleSliderUpdate = (value) => {
    setNewTime(Number(value) + Number(getTimestamp().start));
  }

  return (
    <div id="player">
      <Video 
        videoId={props.videoId}
        timestampData={timestampData}
        newTime={newTime}
        setTimestampData={setTimestampData}
        setCurrentTime={setCurrentTime}
        setCurrentTimestampIndx={setCurrentTimestampIndx}
        handleTimestampSelection={handleTimestampSelection}
        currentTimestampIndx={currentTimestampIndx}
        isPlaying={isPlaying}
        setPlaying={setPlaying}
        isRepeat={isRepeat} />
      <Status
        title={getTimestamp().title}
        startTime={getTimestamp().start}
        currentTime={currentTime}
        endTime={getTimestamp().end}
        sliderUpdate={handleSliderUpdate} />
      <div id="controls">
        <MediaButton
          purpose='shuffle'
          status={isShuffle}
          onClick={toggleShuffle} />
        <MediaButton 
          purpose='prev'
          onClick={() => handleTimestampSelection(currentTimestampIndx - 1)} />
        <MediaButton 
          purpose='play'
          status={isPlaying}
          onClick={() => setPlaying(!isPlaying)} />
        <MediaButton 
          purpose='next'
          onClick={() => handleTimestampSelection(currentTimestampIndx + 1)} />
        <MediaButton
          purpose='repeat'
          status={isRepeat}
          onClick={() => setRepeat(!isRepeat)} />
        <Playlist 
          videoTimestampData={timestampData}
          onTimestampClick={(indx) => handleTimestampSelection(indx, 'chosen')} />
      </div>
    </div>
  )
}

function Status(props) {
  const [currentTime, setCurrentTime] = useState(props.currentTime)
  const [autoUpdate, setAutoUpdate] = useState(true);

  useEffect(() => {
    if (autoUpdate) setCurrentTime(props.currentTime);
  }, [props.currentTime]);

  const finishManualUpdate = () => {
    setAutoUpdate(true);
    props.sliderUpdate(currentTime);
  };

  return (
    <div id="status">
      <h1>
        {props.title}
      </h1>
      <div id="progress">
        <div className="left">{getFormattedDuration(currentTime)}</div>
        <div className="right">{getFormattedDuration(props.endTime - props.startTime)}</div>
        <input 
          className="slider"
          type="range" 
          min="0"
          max={props.endTime - props.startTime}
          value={currentTime}
          onMouseDown={() => setAutoUpdate(false)}
          onTouchStart={() => setAutoUpdate(false)}
          onChange={event => setCurrentTime(event.target.value)} 
          onMouseUp={finishManualUpdate}
          onTouchEnd={finishManualUpdate}/>
      </div>
    </div>
  )
}

function MediaButton(props) {
  let text = '';
  switch (props.purpose) {
    case 'play':
      text = props.status ? <i class="bi bi-pause-fill"></i> : <i class="bi bi-play-fill"></i>;
      break;
    case 'shuffle':
      text = props.status ? 'shuffling' : <i class="bi bi-shuffle"></i>;
      break;
    case 'repeat':
      text = props.status ? 'repeating' : <i class="bi bi-arrow-repeat"></i>;
      break;
    case 'next':
      text = <i class="bi bi-skip-end-fill"></i>;
      break;
    case 'prev':
      text = <i class="bi bi-skip-start-fill"></i>;
      break;
    default:
      text = props.purpose;
      break;
  }
  return (
    <button className={`media-button ${props.purpose}`} onClick={props.onClick}>{text}</button>
  )
}

function Playlist(props) {

  let timestamps = '';
  if (props.videoTimestampData !== null) {
    timestamps = props.videoTimestampData.timestamps.map((timestamp, indx) => 
      <li key={timestamp.title} onClick={() => props.onTimestampClick(indx)} className="grid-container timestamp">
        <div className="title">{timestamp.title}</div>
        <div className="duration">{getFormattedDuration(timestamp.end - timestamp.start)}</div>
      </li>
    );
  }

  return (
    <div id="playlist">
      <ul>
        <li>
          <div className="grid-container">
            <div>Title</div>
            <div>Duration</div>
          </div>
        </li>
        {timestamps}
      </ul>
    </div>
  )
}

function Modal() {
  return (
    <div className="modal">
      <div className="header"></div>
      <div className="body"></div>
      <div className="footer"></div>
    </div>
  )
}

function App() {
  const [videoId, setVideoId] = useState('Q15xiaBTqqY');

  const handleVideoChange = (link) => {
    setVideoId(new URL(link).searchParams.get('v'));
  };

  return (
    <div id="app">
      <PlayerForm 
        onVideoChange={(link) => handleVideoChange(link)}/>
      <Player 
        videoId={videoId}/>
      <Modal />
    </div>
  )
}

export default App;
