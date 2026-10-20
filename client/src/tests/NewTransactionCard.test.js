import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import NewTransactionCard from '../components/NewTransactionCard.vue';

describe('NewTransactionCard.vue', () => {
  it('renders the card illustration, terminal, dollar sign, and label', () => {
    const wrapper = mount(NewTransactionCard);

    expect(wrapper.find('.new-transaction-container').exists()).toBe(true);
    expect(wrapper.find('.new-transaction-card').exists()).toBe(true);
    expect(wrapper.find('.new-transaction-post').exists()).toBe(true);
    expect(wrapper.find('.new-transaction-dollar').text()).toBe('$');
    expect(wrapper.find('.new-transaction-new').text()).toBe('New Transaction');
    expect(wrapper.find('.new-transaction-arrow').exists()).toBe(true);
  });

  it('has accessible button role and aria-label', () => {
    const wrapper = mount(NewTransactionCard);
    const button = wrapper.find('button');

    expect(button.exists()).toBe(true);
    expect(button.attributes('type')).toBe('button');
    expect(button.attributes('aria-label')).toContain('New Transaction');
  });

  it('emits click event when clicked', async () => {
    const wrapper = mount(NewTransactionCard);

    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted()).toHaveProperty('click');
    expect(wrapper.emitted('click').length).toBe(1);
  });
});
