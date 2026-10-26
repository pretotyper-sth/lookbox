import React from 'react';
import { outfitPrice } from '../look-layout.js';
import './feed-items.css';

const { Icon } = window;

export default function FeedItems({ look, onOpen }) {
  const items = (look.items || []).filter((item, i, all) => all.findIndex(x => x.id === item.id) === i);
  if (!items.length || !onOpen) return null;

  return <div className="rc-feed-items" role="region" aria-label="피드 아이템">
    {items.map(item => <button type="button" key={item.id} className="rc-feed-item" onClick={onOpen} aria-label={`${item.name || '아이템'} · 아이템 목록 보기`}>
      <span className="rc-feed-item-image">{item.img ? <img src={item.img} alt="" loading="lazy" draggable={false}/> : <Icon name="hanger" size={24}/>}</span>
      <span className="rc-feed-item-copy">
        {item.brand && <small>{item.brand}</small>}
        <span className="rc-feed-item-name">{item.name || item.category || '아이템'}</span>
        {!!item.price && <strong>{outfitPrice(item.price)}</strong>}
      </span>
    </button>)}
  </div>;
}
