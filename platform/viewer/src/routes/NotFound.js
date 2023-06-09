import React from 'react';
import './NotFound.css';

export default function NotFound({
  message = 'Sorry, this page does not exist.',
}) {
  return (
    <div className={'not-found'}>
      <div>
        <h4>{message}</h4>
      </div>
    </div>
  );
}
