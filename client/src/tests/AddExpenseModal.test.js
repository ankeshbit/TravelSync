import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import AddExpenseModal from '../components/AddExpenseModal.vue';

describe('AddExpenseModal.vue', () => {
  const defaultProps = {
    isOpen: true,
    members: [
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' }
    ],
    tripId: 'test-trip-id'
  };

  it('renders correctly when isOpen prop is true', () => {
    const wrapper = mount(AddExpenseModal, {
      props: defaultProps
    });
    
    // Check if the modal title is present
    expect(wrapper.text()).toContain('Add Expense');
    // Ensure the modal structure exists
    expect(wrapper.find('form').exists()).toBe(true);
  });

  it('submit button is disabled when required fields are empty', () => {
    const wrapper = mount(AddExpenseModal, {
      props: defaultProps
    });
    
    // Initially, title and amount should be empty
    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.element.disabled).toBe(true);
  });

  it('entering a valid amount and title enables the submit button', async () => {
    const wrapper = mount(AddExpenseModal, {
      props: defaultProps
    });

    await wrapper.find('input[placeholder="e.g. Dinner at Luigi\'s"]').setValue('Dinner');
    await wrapper.find('input[placeholder="0.00"]').setValue('50.00');
    // paidBy and splitAmong might be initialized by default, but if not we should set them.
    // Assuming the component requires paidBy to be set:
    await wrapper.find('select').setValue('1'); // Select Alice as payer

    // If splitAmong requires manual interaction, we assume it's pre-selected (all members)
    
    const submitBtn = wrapper.find('button[type="submit"]');
    // Check if it's enabled now
    expect(submitBtn.element.disabled).toBe(false);
  });

  it('emits close event when the cancel button is clicked', async () => {
    const wrapper = mount(AddExpenseModal, {
      props: defaultProps
    });

    // Find the cancel button (usually contains text "Cancel")
    const cancelBtn = wrapper.findAll('button').find(w => w.text().includes('Cancel'));
    await cancelBtn.trigger('click');

    expect(wrapper.emitted()).toHaveProperty('close');
  });

  it('emits submit event with correct payload on form submission', async () => {
    const wrapper = mount(AddExpenseModal, {
      props: defaultProps
    });

    await wrapper.find('input[placeholder="e.g. Dinner at Luigi\'s"]').setValue('Dinner');
    await wrapper.find('input[placeholder="0.00"]').setValue('50.00');
    
    // We assume default selection sets paidBy and splitAmong appropriately.
    // Trigger submit
    await wrapper.find('form').trigger('submit.prevent');

    expect(wrapper.emitted()).toHaveProperty('submit');
    const submitEvent = wrapper.emitted('submit')[0][0];
    
    expect(submitEvent).toMatchObject({
      title: 'Dinner',
      amount: '50.00' // or 50 depending on component logic
    });
  });
});
